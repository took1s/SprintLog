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

            sortMode: 'fav', // По умолчанию показываем любимые сверху
            isSortOpen: false,
            favorites: [],   // Массив ID любимых упражнений
            activeMuscleFilters: [],
            
            exercises: [],
            
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
            completedSets: []
        }
    },
    computed: {

        groupedHistory() {
            const groups = {};
            
            this.historyData.forEach(workout => {
                const date = workout.date.split('T')[0];
                const type = workout.workoutType;
                
                if (!groups[date]) groups[date] = {};
                if (!groups[date][type]) groups[date][type] = {};
                
                workout.sets.forEach(set => {
                    const name = set.exerciseName;
                    if (!groups[date][type][name]) {
                        groups[date][type][name] = [];
                    }
                    groups[date][type][name].push(set);
                });
            });
            return groups;
        },

        availableMuscleGroups() {
            const groups = new Set();
            this.exercises
                .filter(e => e.category === this.activeCategory)
                .forEach(e => groups.add(e.muscleGroup));
            return Array.from(groups).sort();
        },

        filteredExercises() {
            // 1. Фильтр по категории
            let result = this.exercises.filter(e => e.category === this.activeCategory);

            // 2. Фильтр по поиску
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase().trim();
                result = result.filter(e => e.name.toLowerCase().includes(query) || e.muscleGroup.toLowerCase().includes(query));
            }

            // 3. Фильтр по мышцам
            if (this.activeMuscleFilters.length > 0) {
                result = result.filter(e => this.activeMuscleFilters.includes(e.muscleGroup));
            }

            // 4. Сортировка
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
                // По умолчанию А-Я
                return a.name.localeCompare(b.name);
            });

            return result;
        },

        currentSortLabel() {
            const labels = {
                'fav': 'Favorites',
                'freq': 'Most Used',
                'az': 'A - Z',
                'za': 'Z - A'
            };
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

        // Вычисление общего объема (тоннажа) для тренировки
        getWorkoutVolume(sets) {
            return sets.reduce((sum, set) => {
                // Для зала: вес * повторы. Для поля можно игнорировать или считать иначе
                if (set.weight && set.reps) return sum + (set.weight * set.reps);
                return sum;
            }, 0);
        },

        // Проверка на PR
        isPersonalBest(exName, currentWeight, currentReps) {
            // Получаем все прошлые записи этого упражнения до текущей даты
            // (для простоты можно проверять по всей истории)
            const history = this.historyData;
            let max = 0;
            
            history.forEach(w => {
                w.sets.forEach(s => {
                    if (s.exerciseName === exName && s.weight) {
                        // Считаем объем (вес * повторы) как метрику силы
                        const volume = s.weight * s.reps;
                        if (volume > max) max = volume;
                    }
                });
            });
            
            return (currentWeight * currentReps) > max && max > 0;
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
            this.isSortOpen = false; // Закрываем меню после выбора
        },


        toggleFavorite(ex) {
            const index = this.favorites.indexOf(ex.id);
            if (index > -1) {
                this.favorites.splice(index, 1); // Удаляем
            } else {
                this.favorites.push(ex.id); // Добавляем
            }
            // Сохраняем в кэш с привязкой к имени пользователя
            localStorage.setItem(`sprintlog_favs_${this.loginData.username}`, JSON.stringify(this.favorites));
        },
        loadFavorites() {
            const saved = localStorage.getItem(`sprintlog_favs_${this.loginData.username}`);
            this.favorites = saved ? JSON.parse(saved) : [];
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
                    // Если регистрация успешна, сразу переводим в режим логина и логиним
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
            this.currentEx = ex;
            this.showModal = true;
            this.weight = 20; this.reps = 10; this.distance = 30; this.time = 4.5;
        },
        closeModal() { this.showModal = false; setTimeout(() => this.currentEx = null, 300); },
        
        saveSet() {
            this.completedSets.push({
                exerciseId: this.currentEx.id,
                name: this.currentEx.name,
                weight: this.activeCategory === 'Gym' ? this.weight : null,
                reps: this.activeCategory === 'Gym' ? this.reps : null,
                distance: this.activeCategory === 'Football' ? this.distance : null,
                time: this.activeCategory === 'Football' ? this.time : null
            });
            localStorage.setItem('sprintlog_sets', JSON.stringify(this.completedSets));
            this.closeModal();
        },
        
        async clearWorkout() {
            const confirmed = await this.showConfirm(
                'System Alert', 
                'Clear active session data?'
            );
            
            if (confirmed) {
                this.completedSets = []; 
                localStorage.removeItem('sprintlog_sets');
            }
        },

        async finishWorkout() {
            this.isSaving = true;
            
            const workout = {
                id: Date.now(), 
                workoutType: this.activeCategory,
                sets: this.completedSets.map(s => ({
                    exerciseId: s.exerciseId, Weight: s.weight, Reps: s.reps, Distance: s.distance, Time: s.time
                })),
                status: 'pending' 
            };

            let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
            queue.push(workout);
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

                    if (setsForExercise[0].weight !== null) {
                        const maxWeight = Math.max(...setsForExercise.map(s => s.weight));
                        chartData.push(maxWeight);
                    } 
                    else if (setsForExercise[0].time !== null) {
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
                        pointBackgroundColor: '#fff',
                        pointRadius: 4,
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { 
                            beginAtZero: false,
                            grid: { color: '#27272a' }
                        },
                        x: {
                            grid: { display: false }
                        }
                    }
                }
            });
        }
    }
}).mount('#app');