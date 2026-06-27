Chart.defaults.color = '#a1a1aa';
Chart.defaults.borderColor = '#27272a';
Chart.defaults.font.family = 'Inter';

const { createApp } = Vue;

createApp({
    data() {
        return {
            isLoginMode: true,
            isAuthenticated: false,
            token: '',
            loginData: { username: '', password: '' },
            isLoggingIn: false,
            loginError: '',
            isOffline: !navigator.onLine,
            
            activeCategory: 'Gym', 
            analyticsTab: 'history', 
            searchQuery: '',

            sortMode: 'fav',
            isSortOpen: false,
            favorites: [],
            activeMuscleFilters: [],
            
            exercises: [],
            loading: true,
            isSaving: false,

            dialog: {
                isOpen: false,
                title: '',
                message: '',
                resolve: null
            },

            historyData: [],
            loadingHistory: false,
            selectedChartExercise: '',
            chartInstance: null,

            showModal: false,
            currentEx: null,
            weight: 20, reps: 10,
            distance: 30, time: 4.5,
            completedSets: [],
            showSessionReview: false,
            
            editingSetIndex: null,

            // НОВЫЙ БЛОК: Состояние таймера отдыха
            restTimer: {
                active: false,
                timeLeft: 0,
                duration: 90, // по умолчанию 90 секунд
                interval: null
            }
        }
    },

    computed: {
        allTimeRecords() {
            const records = {};
            this.historyData.forEach(workout => {
                workout.sets.forEach(set => {
                    if (!records[set.exerciseName]) {
                        records[set.exerciseName] = { maxWeight: 0, maxVolume: 0, maxDistance: 0, maxSpeed: 0 };
                    }
                    const r = records[set.exerciseName];
                    
                    if (set.weight > r.maxWeight) r.maxWeight = set.weight;
                    const vol = (set.weight || 0) * (set.reps || 0);
                    if (vol > r.maxVolume) r.maxVolume = vol;
                    
                    if (set.distance > r.maxDistance) r.maxDistance = set.distance;
                    const speed = (set.distance > 0 && set.time > 0) ? (set.distance / set.time) : 0;
                    if (speed > r.maxSpeed) r.maxSpeed = speed;
                });
            });
            return records;
        },

        // --- ПРОФЕССИОНАЛЬНАЯ ТЕЛЕМЕТРИЯ ---
        
        // 1. Расчет 1RM по формуле Эпли на лету
        currentEstimated1RM() {
            if (this.activeCategory !== 'Gym' || !this.weight || !this.reps || this.weight <= 0 || this.reps <= 0) return 0;
            if (this.reps === 1) return this.weight;
            return Math.round(this.weight * (1 + this.reps / 30));
        },

        // 2. Интенсивность (Процент от твоего All-Time PR для этого упражнения)
        currentIntensity() {
            if (this.activeCategory !== 'Gym' || !this.currentEx || !this.weight) return 0;
            const pr = this.allTimeRecords[this.currentEx.name]?.maxWeight || 0;
            if (pr === 0) return 0; // Если рекорда еще нет
            return Math.round((this.weight / pr) * 100);
        },

        // 3. Анализ целевой зоны тренировки
        trainingZone() {
            if (!this.reps || this.reps <= 0) return { name: 'Awaiting Metrics', color: 'text-slate-500' };
            if (this.reps <= 5) return { name: 'Strength / Power', color: 'text-red-400' };
            if (this.reps <= 12) return { name: 'Hypertrophy', color: 'text-[#00c3ff]' };
            return { name: 'Endurance', color: 'text-emerald-400' };
        },

        previousSetData() {
            if (!this.currentEx || !this.historyData || this.historyData.length === 0) return null;
            const sortedWorkouts = [...this.historyData].sort((a, b) => new Date(b.date) - new Date(a.date));
            for (const workout of sortedWorkouts) {
                const sets = workout.sets;
                for (let i = sets.length - 1; i >= 0; i--) {
                    if (sets[i].exerciseName === this.currentEx.name) {
                        return sets[i];
                    }
                }
            }
            return null;
        },

        heatmapData() {
            const map = {};
            let maxVol = 0;
            this.historyData.forEach(w => {
                const date = w.date.split('T')[0];
                const vol = w.sets.reduce((sum, set) => sum + ((set.weight || 0) * (set.reps || 0)), 0);
                map[date] = (map[date] || 0) + vol;
                if (map[date] > maxVol) maxVol = map[date];
            });

            const days = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                
                const vol = map[dateStr] || 0;
                let intensity = 0;
                if (vol > 0) {
                    const ratio = vol / (maxVol || 1);
                    if (ratio > 0.75) intensity = 4;
                    else if (ratio > 0.5) intensity = 3;
                    else if (ratio > 0.25) intensity = 2;
                    else intensity = 1;
                }
                days.push({ date: dateStr, volume: vol, intensity });
            }
            return days;
        },

        availableMuscleGroups() {
            const groups = new Set();
            this.exercises
                .filter(e => e.category === this.activeCategory)
                .forEach(e => groups.add(e.muscleGroup));
            return Array.from(groups).sort();
        },

        filteredExercises() {
            let result = this.exercises.filter(e => e.category === this.activeCategory);

            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase().trim();
                result = result.filter(e => e.name.toLowerCase().includes(query) || e.muscleGroup.toLowerCase().includes(query));
            }

            if (this.activeMuscleFilters.length > 0) {
                result = result.filter(e => this.activeMuscleFilters.includes(e.muscleGroup));
            }

            result.sort((a, b) => {
                const aFav = this.favorites.includes(a.id) ? 1 : 0;
                const bFav = this.favorites.includes(b.id) ? 1 : 0;

                if (this.sortMode === 'fav') {
                    if (aFav !== bFav) return bFav - aFav; 
                    return a.name.localeCompare(b.name);
                }
                if (this.sortMode === 'freq') {
                    const aCount = this.exerciseUsage[a.name] || 0;
                    const bCount = this.exerciseUsage[b.name] || 0;
                    if (aCount !== bCount) return bCount - aCount;
                    return a.name.localeCompare(b.name);
                }
                if (this.sortMode === 'za') {
                    return b.name.localeCompare(a.name);
                }
                return a.name.localeCompare(b.name);
            });

            return result;
        },

        currentSortLabel() {
            const labels = { 'fav': 'Favorites', 'freq': 'Most Used', 'az': 'A - Z', 'za': 'Z - A' };
            return labels[this.sortMode];
        },

        exerciseUsage() {
            const usage = {};
            this.historyData.forEach(workout => {
                workout.sets.forEach(set => {
                    usage[set.exerciseName] = (usage[set.exerciseName] || 0) + 1;
                });
            });
            return usage;
        },

        uniqueHistoryExercises() {
            const names = new Set();
            this.historyData.forEach(workout => {
                workout.sets.forEach(set => names.add(set.exerciseName));
            });
            return Array.from(names).sort();
        },

        activeDays() {
            const dates = new Set();
            this.historyData.forEach(w => {
                dates.add(w.date.split('T')[0]);
            });
            return Array.from(dates).sort((a, b) => new Date(b) - new Date(a));
        }
    },
    async mounted() {
        window.addEventListener('online', () => { 
            this.isOffline = false; 
            this.syncPendingWorkouts(); 
            this.fetchExercises();
        });
        window.addEventListener('offline', () => { this.isOffline = true; });

        const savedToken = localStorage.getItem('sprintlog_jwt');
        if (savedToken) {
            this.token = savedToken;
            this.isAuthenticated = true;
            await this.refreshToken(); 

            if (this.isAuthenticated) {
                await this.syncPendingWorkouts();
                await this.fetchExercises();
                await this.loadHistory();
                this.loadFavorites();
            }
        } else {
            this.loading = false;
        }

        const savedSets = localStorage.getItem('sprintlog_sets');
        if (savedSets) this.completedSets = JSON.parse(savedSets);
    },
    methods: {

        // Быстрая установка веса по проценту от абсолютного рекорда (1RM)
        setWeightByPercentage(percent) {
            if (!this.currentEx) return;
            const pr = this.allTimeRecords[this.currentEx.name]?.maxWeight || 0;
            
            if (pr > 0) {
                // Считаем вес и округляем до ближайших 2.5 кг (стандартный шаг блинов в зале)
                const rawWeight = pr * (percent / 100);
                this.weight = Math.round(rawWeight / 2.5) * 2.5;
            }
        },

        groupSets(sets) {
            const groups = [];
            const map = new Map();
            const prs = this.allTimeRecords; 

            sets.forEach(set => {
                if (!map.has(set.exerciseName)) {
                    map.set(set.exerciseName, { name: set.exerciseName, sets: [] });
                    groups.push(map.get(set.exerciseName));
                }

                let badges = [];
                const r = prs[set.exerciseName];
                
                if (r) {
                    if (set.weight > 0 && set.weight === r.maxWeight) {
                        badges.push({ label: '👑 MAX WT', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30 shadow-[0_0_10px_rgba(250,204,21,0.2)]' });
                    }
                    const vol = (set.weight || 0) * (set.reps || 0);
                    if (vol > 0 && vol === r.maxVolume) {
                        badges.push({ label: '🔥 MAX VOL', color: 'text-orange-400 bg-orange-400/10 border-orange-400/30 shadow-[0_0_10px_rgba(249,115,22,0.2)]' });
                    }
                    
                    if (set.distance > 0 && set.distance === r.maxDistance) {
                        badges.push({ label: '👑 MAX DIST', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30 shadow-[0_0_10px_rgba(250,204,21,0.2)]' });
                    }
                    const speed = (set.distance > 0 && set.time > 0) ? +(set.distance / set.time).toFixed(2) : 0;
                    if (speed > 0 && speed === +(r.maxSpeed).toFixed(2)) {
                        badges.push({ label: '⚡ TOP SPD', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30 shadow-[0_0_10px_rgba(52,211,153,0.2)]' });
                    }
                }

                map.get(set.exerciseName).sets.push({
                    ...set,
                    badges: badges.slice(0, 2) 
                });
            });
            
            return groups;
        },

        

        getWorkoutStats(workout) {
            let totalVolume = 0;
            let totalDistance = 0;
            
            workout.sets.forEach(s => {
                if (s.weight > 0 && s.reps > 0) totalVolume += (s.weight * s.reps);
                if (s.distance > 0) totalDistance += s.distance;
            });
            
            let stats = [];
            if (totalVolume > 0) stats.push(`${totalVolume} KG VOL`);
            if (totalDistance > 0) stats.push(`${totalDistance} M DIST`);
            
            return stats.length > 0 ? stats.join(' • ') : 'NO METRICS';
        },

        repeatWorkout(workout) {
            if (this.completedSets.length > 0) {
                if (!confirm("Warning: This will overwrite your currently active session. Proceed?")) return;
            }
            
            this.completedSets = workout.sets.map(s => {
                const ex = this.exercises.find(e => e.name === s.exerciseName);
                return {
                    exerciseId: ex ? ex.id : 0,
                    name: s.exerciseName,
                    weight: s.weight || 0,
                    reps: s.reps || 0,
                    distance: s.distance || 0,
                    time: s.time || 0
                };
            });
            
            localStorage.setItem('sprintlog_sets', JSON.stringify(this.completedSets));
            this.activeCategory = workout.workoutType === 'Gym' ? 'Gym' : 'Football';
            this.showSessionReview = true;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        copyPrevious() {
            if (!this.previousSetData) return;
            
            if (!this.isTimeBased(this.currentEx)) {
                this.weight = this.previousSetData.weight > 0 ? this.previousSetData.weight : this.weight;
                this.reps = this.previousSetData.reps > 0 ? this.previousSetData.reps : this.reps;
            } else {
                this.distance = this.previousSetData.distance > 0 ? this.previousSetData.distance : this.distance;
                this.time = this.previousSetData.time > 0 ? this.previousSetData.time : this.time;
            }
        },

        getTotalTypeVolume(exercisesObj) {
            let sum = 0;
            Object.values(exercisesObj).forEach(sets => {
                sum += sets.reduce((s, set) => s + ((set.weight || 0) * (set.reps || 0)), 0);
            });
            return sum;
        },

        isPR(exName, weight) {
            if (!weight) return false;
            let max = 0;
            this.historyData.forEach(w => w.sets.forEach(s => {
                if (s.exerciseName === exName && s.weight > max) max = s.weight;
            }));
            return weight === max && weight > 0;
        },

        getTrend(exName, currentDate, currentWeight) {
            if (!currentWeight) return null;
            const pastWorkouts = this.historyData.filter(w => w.date.split('T')[0] < currentDate);
            if (pastWorkouts.length === 0) return null;

            let lastWeight = 0;
            for (let w of pastWorkouts) {
                const sets = w.sets.filter(s => s.exerciseName === exName);
                if (sets.length > 0) {
                    lastWeight = Math.max(...sets.map(s => s.weight || 0));
                    break;
                }
            }

            if (lastWeight === 0) return null;
            if (currentWeight > lastWeight) return 'up';
            if (currentWeight < lastWeight) return 'down';
            return 'same';
        },

        isTimeBased(ex) {
            if (!ex) return false;
            if (ex.category === 'Football') return true;
            if (ex.muscleGroup === 'Cardio') return true;
            const name = ex.name.toLowerCase();
            if (name.includes('plank') || name.includes('hold')) return true;
            return false;
        },

        showConfirm(title, message) {
            this.dialog.title = title;
            this.dialog.message = message;
            this.dialog.isOpen = true;
            return new Promise((resolve) => {
                this.dialog.resolve = resolve;
            });
        },

        resolveDialog(result) {
            this.dialog.isOpen = false;
            this.dialog.resolve(result);
        },

        toggleMuscleFilter(muscle) {
            if (this.activeMuscleFilters.includes(muscle)) {
                this.activeMuscleFilters = this.activeMuscleFilters.filter(m => m !== muscle);
            } else {
                this.activeMuscleFilters.push(muscle);
            }
        },

        selectSort(mode) {
            this.sortMode = mode;
            this.isSortOpen = false; 
        },

        async toggleFavorite(ex) {
            const isFav = this.favorites.includes(ex.id);
            const method = isFav ? 'DELETE' : 'POST';
            
            if (isFav) this.favorites = this.favorites.filter(id => id !== ex.id);
            else this.favorites.push(ex.id);

            try {
                await fetch(`/api/favorites/${ex.id}`, {
                    method: method,
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
            } catch (e) {
                await this.loadFavorites();
                console.error('Sync failed', e);
            }
        },

        async loadFavorites() {
            try {
                const res = await fetch('/api/favorites', {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (res.ok) this.favorites = await res.json();
            } catch (e) { console.error('Error loading favs', e); }
        },

        async register() {
            this.isLoggingIn = true;
            this.loginError = '';
            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.loginData)
                });
                
                if (res.ok) {
                    this.isLoginMode = true;
                    await this.login();
                } else {
                    const data = await res.json();
                    this.loginError = data.Message || 'Registration failed';
                }
            } catch (e) {
                this.loginError = 'Server connection error';
            } finally {
                this.isLoggingIn = false;
            }
        },

        async refreshToken() {
            if (!this.token) return;
            try {
                const res = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    this.token = data.token;
                    localStorage.setItem('sprintlog_jwt', this.token);
                } else if (res.status === 401) {
                    this.logout(); 
                }
            } catch (e) {
                console.error('Offline or server error during refresh', e);
            }
        },

        async login() {
            this.isLoggingIn = true;
            this.loginError = '';
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.loginData)
                });
                
                if (res.ok) {
                    const data = await res.json();
                    this.token = data.token;
                    localStorage.setItem('sprintlog_jwt', this.token);
                    this.isAuthenticated = true;
                    await this.fetchExercises();
                    await this.loadHistory(); 
                    this.loadFavorites();
                } else {
                    this.loginError = 'Invalid username or password';
                }
            } catch (e) {
                this.loginError = 'Server connection error';
            } finally {
                this.isLoggingIn = false;
            }
        },
        
        logout() {
            this.token = '';
            this.isAuthenticated = false;
            localStorage.removeItem('sprintlog_jwt');
            this.loginData.password = '';
        },

        formatDate(isoString) {
            const d = new Date(isoString);
            return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
        },
        getMonthShort(dateString) { return new Date(dateString).toLocaleDateString('en-US', { month: 'short' }); },
        getDay(dateString) { return new Date(dateString).getDate(); },

        switchTab(tab) {
            this.activeCategory = tab;
            if (tab === 'Analytics') {
                this.loadHistory();
            }
        },

        async fetchExercises() {
            if (!this.isAuthenticated) return;
            this.loading = true;
            try {
                const res = await fetch('/api/exercises', {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                
                if (res.ok) {
                    this.exercises = await res.json();
                } else if (res.status === 401) {
                    this.logout(); 
                }
            } catch (e) {
                this.isOffline = true; 
            } finally {
                this.loading = false;
            }
        },

        async loadHistory() {
            if (!this.isAuthenticated) return;
            this.loadingHistory = true;
            try {
                const res = await fetch('/api/workouts/history', {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (res.status === 401) {
                    this.logout();
                    return;
                }
                this.historyData = await res.json();
            } catch (e) { console.error('History fetch error:', e); } 
            finally { this.loadingHistory = false; }
        },

        openModal(ex) { 
            this.editingSetIndex = null;
            this.currentEx = ex; 
            this.showModal = true; 
        },

        closeModal() { this.showModal = false; setTimeout(() => this.currentEx = null, 300); },
        
        saveSet() {
            const isGym = this.activeCategory === 'Gym';
            const setPayload = { 
                exerciseId: this.currentEx.id, 
                name: this.currentEx.name, 
                weight: isGym ? this.weight : 0, 
                reps: isGym ? this.reps : 0, 
                distance: !isGym ? this.distance : 0, 
                time: !isGym ? this.time : 0 
            };

            if (this.editingSetIndex !== null) {
                this.completedSets[this.editingSetIndex] = setPayload;
                this.editingSetIndex = null; 
            } else {
                this.completedSets.push(setPayload);
                // ЗАПУСК ТАЙМЕРА (90 сек для зала, 120 сек для поля)
                this.startRestTimer(isGym ? 90 : 120);
            }
            
            localStorage.setItem('sprintlog_sets', JSON.stringify(this.completedSets)); 
            this.closeModal();
        },

        editSet(idx) {
            const set = this.completedSets[idx];
            const ex = this.exercises.find(e => e.id === set.exerciseId) || { id: set.exerciseId, name: set.name, category: set.weight > 0 ? 'Gym' : 'Football', muscleGroup: 'Unknown' };
            
            this.currentEx = ex;
            this.activeCategory = ex.category;
            
            this.weight = set.weight || 0;
            this.reps = set.reps || 0;
            this.distance = set.distance || 0;
            this.time = set.time || 0;
            
            this.editingSetIndex = idx;
            this.showSessionReview = false; 
            this.showModal = true;          
        },

        removeSet(idx) {
            this.completedSets.splice(idx, 1);
            localStorage.setItem('sprintlog_sets', JSON.stringify(this.completedSets));
            if (this.completedSets.length === 0) this.showSessionReview = false;
        },
        
        clearWorkout() { 
            if (confirm('Critical: Abort entire active session?')) { 
                this.completedSets = []; 
                localStorage.removeItem('sprintlog_sets'); 
                this.showSessionReview = false;
            } 
        },

        async finishWorkout() {
            this.isSaving = true;
            
            const hasGym = this.completedSets.some(s => s.weight > 0 || s.reps > 0);
            const hasField = this.completedSets.some(s => s.distance > 0 || s.time > 0);
            
            let sessionType = 'Hybrid';
            if (hasGym && !hasField) sessionType = 'Gym';
            if (!hasGym && hasField) sessionType = 'Football';
            if (!hasGym && !hasField) sessionType = 'Gym'; 

            let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
            queue.push({ id: Date.now(), workoutType: sessionType, sets: this.completedSets, status: 'pending' });
            
            localStorage.setItem('sync_queue', JSON.stringify(queue));
            this.completedSets = []; 
            localStorage.removeItem('sprintlog_sets');
            
            await this.syncPendingWorkouts(); 
            this.isSaving = false; 
            this.switchTab('Analytics');
        },

        async syncPendingWorkouts() {
            let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
            if (queue.length === 0) return;

            for (let i = 0; i < queue.length; i++) {
                if (queue[i].status === 'synced') continue;

                try {
                    const res = await fetch('/api/workouts/save', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.token}`
                        },
                        body: JSON.stringify({
                            WorkoutType: queue[i].workoutType,
                            Sets: queue[i].sets
                        })
                    });

                    if (res.ok) {
                        queue[i].status = 'synced'; 
                    }
                } catch (e) {
                    console.log('Network error, will retry later');
                    break; 
                }
            }

            const remaining = queue.filter(w => w.status !== 'synced');
            localStorage.setItem('sync_queue', JSON.stringify(remaining));
            
            if (remaining.length === 0 && this.analyticsTab === 'history') {
                await this.loadHistory();
            }
        },

        drawChart() {
            if (!this.selectedChartExercise) return;

            const chartLabels = [];
            const chartData = [];
            let isTimeBased = false;

            const reversedHistory = [...this.historyData].reverse();

            reversedHistory.forEach(workout => {
                const setsForExercise = workout.sets.filter(s => s.exerciseName === this.selectedChartExercise);
                
                if (setsForExercise.length > 0) {
                    chartLabels.push(this.formatDate(workout.date));

                    if (setsForExercise[0].weight !== null && setsForExercise[0].weight > 0) {
                        const maxWeight = Math.max(...setsForExercise.map(s => s.weight));
                        chartData.push(maxWeight);
                    } 
                    else if (setsForExercise[0].time !== null && setsForExercise[0].time > 0) {
                        isTimeBased = true;
                        const minTime = Math.min(...setsForExercise.map(s => s.time));
                        chartData.push(minTime);
                    }
                }
            });

            if (this.chartInstance) {
                this.chartInstance.destroy();
            }

            const ctx = document.getElementById('progressChart');
            const lineColor = isTimeBased ? '#10b981' : '#3b82f6';
            const labelText = isTimeBased ? 'Best Time (seconds)' : 'Max Weight (kg)';

            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: labelText,
                        data: chartData,
                        borderColor: lineColor,
                        backgroundColor: lineColor + '33', 
                        borderWidth: 3,
                        pointBackgroundColor: '#02040a', 
                        pointBorderColor: lineColor,
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        fill: true,
                        tension: 0.4 
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleFont: { family: 'Inter', size: 11 },
                            bodyFont: { family: 'Inter', size: 13, weight: 'bold' },
                            padding: 10,
                            displayColors: false,
                            cornerRadius: 8,
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        y: { 
                            beginAtZero: false,
                            grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] }, 
                            ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
                        }
                    }
                }
            });
        },
        // ... другие методы ...

        // --- ЛОГИКА ТАЙМЕРА ОТДЫХА ---
        startRestTimer(seconds) {
            this.stopRestTimer();
            this.restTimer.duration = seconds;
            this.restTimer.timeLeft = seconds;
            this.restTimer.active = true;

            this.restTimer.interval = setInterval(() => {
                this.restTimer.timeLeft -= 1;
                if (this.restTimer.timeLeft <= 0) {
                    this.finishRestTimer();
                }
            }, 1000);
        },

        stopRestTimer() {
            if (this.restTimer.interval) clearInterval(this.restTimer.interval);
            this.restTimer.active = false;
        },

        adjustRestTimer(amount) {
            this.restTimer.timeLeft += amount;
            if (this.restTimer.timeLeft <= 0) this.finishRestTimer();
        },

        finishRestTimer() {
            this.stopRestTimer();
            this.playRestAlarm();
        },

        formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
        },

        playRestAlarm() {
            // 1. Вибрация (Haptic Feedback) - работает на Android
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 400]);
            }
            
            // 2. Генерация звука (Web Audio API) - работает везде, не требует mp3
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.type = 'sine'; // Мягкий сигнал
                osc.frequency.setValueAtTime(880, ctx.currentTime); // Нота Ля (A5)
                gain.gain.setValueAtTime(0.1, ctx.currentTime); // Громкость 10%
                
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.6); // Длительность 0.6 сек
            } catch (e) {
                console.log('Audio API not supported or blocked', e);
            }
        },
    }


}).mount('#app');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('ServiceWorker registration failed:', error);
            });
    });
}