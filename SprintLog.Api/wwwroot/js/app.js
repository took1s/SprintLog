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

        // Генератор данных для Heatmap (Календарь)
        heatmapData() {
            const map = {};
            let maxVol = 0;

            // Считаем объем за каждый день в истории
            this.historyData.forEach(w => {
                const date = w.date.split('T')[0];
                const vol = w.sets.reduce((sum, set) => sum + ((set.weight || 0) * (set.reps || 0)), 0);
                map[date] = (map[date] || 0) + vol;
                if (map[date] > maxVol) maxVol = map[date];
            });

            const days = [];
            // Создаем массив за последние 30 дней
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                
                const vol = map[dateStr] || 0;

                // Определяем интенсивность цвета (0-4) как в GitHub
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

        // Подсчет тоннажа для группы упражнений
        getTotalTypeVolume(exercisesObj) {
            let sum = 0;
            Object.values(exercisesObj).forEach(sets => {
                sum += sets.reduce((s, set) => s + ((set.weight || 0) * (set.reps || 0)), 0);
            });
            return sum;
        },

        // Проверка на личный рекорд (PR)
        isPR(exName, weight) {
            if (!weight) return false;
            let max = 0;
            this.historyData.forEach(w => w.sets.forEach(s => {
                if (s.exerciseName === exName && s.weight > max) max = s.weight;
            }));
            return weight === max && weight > 0;
        },

        // Сравнение с прошлым результатом (Тренд)
        getTrend(exName, currentDate, currentWeight) {
            if (!currentWeight) return null;
            
            // Ищем все тренировки ДО текущей даты
            const pastWorkouts = this.historyData.filter(w => w.date.split('T')[0] < currentDate);
            if (pastWorkouts.length === 0) return null;

            let lastWeight = 0;
            // Ищем самый свежий результат в прошлом
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
            
            // 1. Все упражнения на поле (Football) - это время/дистанция
            if (ex.category === 'Football') return true;
            
            // 2. Всё кардио в зале - это время/дистанция
            if (ex.muscleGroup === 'Cardio') return true;
            
            // 3. Исключения (изометрические упражнения вроде планки)
            const name = ex.name.toLowerCase();
            if (name.includes('plank') || name.includes('hold')) return true;

            // По умолчанию для зала возвращаем классику (вес/повторы)
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
            // Проверяем, требует ли текущее упражнение время
            const isTime = this.isTimeBased(this.currentEx);

            this.completedSets.push({
                exerciseId: this.currentEx.id,
                name: this.currentEx.name,
                // Если упражнение на время, вес и повторы ставим null
                weight: !isTime ? this.weight : null,
                reps: !isTime ? this.reps : null,
                // Если упражнение на время, записываем дистанцию и секунды
                distance: isTime ? this.distance : null,
                time: isTime ? this.time : null
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
                        backgroundColor: lineColor + '33', // Полупрозрачная заливка под линией
                        borderWidth: 3,
                        pointBackgroundColor: '#02040a', // Темные точки внутри
                        pointBorderColor: lineColor,
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        fill: true,
                        tension: 0.4 // <--- ГЛАВНЫЙ СЕКРЕТ: Делает линию плавной (без острых углов)
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
                            grid: { color: 'rgba(255,255,255,0.05)', borderDash: [5, 5] }, // Пунктирная сетка
                            ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
                        }
                    }
                }
            });
        }
    }
}).mount('#app');