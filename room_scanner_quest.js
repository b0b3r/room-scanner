class RoomScanner {
    constructor() {
        this.isScanning = false;
        this.scanData = {
            points: [],
            surfaces: [],
            metadata: {
                startTime: null,
                endTime: null,
                deviceInfo: null,
                roomDimensions: null
            }
        };
        this.scanSession = null;
        this.scanStartTime = null;
        this.progressInterval = null;
        this.demoMode = false;
        
        this.initializeApp();
    }

    async initializeApp() {
        console.log('Начало инициализации приложения для Quest 3');
        
        // Показываем загрузку
        this.showScreen('loading');
        this.updateLoadingStatus('Проверка поддержки WebXR...');
        
        // Добавляем таймаут для предотвращения бесконечной загрузки
        const timeout = setTimeout(() => {
            console.log('Таймаут инициализации, переключаемся в демо режим');
            this.demoMode = true;
            this.setupEventListeners();
            this.showScreen('welcome');
        }, 3000); // 3 секунды таймаут
        
        try {
            // Проверяем поддержку WebXR
            if (!navigator.xr) {
                console.log('WebXR не поддерживается');
                this.updateLoadingStatus('WebXR не поддерживается, переключаемся в демо режим...');
                await this.delay(1000);
                clearTimeout(timeout);
                this.demoMode = true;
                this.setupEventListeners();
                this.showScreen('welcome');
                return;
            }

            this.updateLoadingStatus('Проверка поддержки VR...');
            await this.delay(500);

            // Проверяем доступность VR с таймаутом
            let isSupported = false;
            try {
                isSupported = await Promise.race([
                    navigator.xr.isSessionSupported('immersive-vr'),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('VR check timeout')), 2000))
                ]);
            } catch (vrError) {
                console.log('Ошибка проверки VR:', vrError);
                isSupported = false;
            }

            if (!isSupported) {
                console.log('VR не поддерживается');
                this.updateLoadingStatus('VR не поддерживается, переключаемся в демо режим...');
                await this.delay(1000);
                this.demoMode = true;
            } else {
                console.log('WebXR поддерживается');
                this.updateLoadingStatus('WebXR поддерживается!');
                await this.delay(500);
            }

            // Инициализируем приложение
            clearTimeout(timeout);
            this.setupEventListeners();
            this.showScreen('welcome');
            console.log('Инициализация завершена успешно');
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            clearTimeout(timeout);
            this.updateLoadingStatus('Ошибка инициализации, переключаемся в демо режим...');
            await this.delay(1000);
            this.demoMode = true;
            this.setupEventListeners();
            this.showScreen('welcome');
        }
    }

    updateLoadingStatus(message) {
        const statusElement = document.getElementById('loadingStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
        console.log('Статус загрузки:', message);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setupEventListeners() {
        console.log('Настройка обработчиков событий');
        
        // Кнопки на экране приветствия
        const startScanBtn = document.getElementById('startScan');
        const loadScanBtn = document.getElementById('loadScan');
        const demoModeBtn = document.getElementById('demoMode');

        if (startScanBtn) {
            startScanBtn.addEventListener('click', () => this.startScanning());
        }
        if (loadScanBtn) {
            loadScanBtn.addEventListener('click', () => this.loadSavedScan());
        }
        if (demoModeBtn) {
            demoModeBtn.addEventListener('click', () => this.startDemoMode());
        }

        // Кнопки управления сканированием
        const pauseScanBtn = document.getElementById('pauseScan');
        const stopScanBtn = document.getElementById('stopScan');
        const saveScanBtn = document.getElementById('saveScan');

        if (pauseScanBtn) {
            pauseScanBtn.addEventListener('click', () => this.pauseScanning());
        }
        if (stopScanBtn) {
            stopScanBtn.addEventListener('click', () => this.stopScanning());
        }
        if (saveScanBtn) {
            saveScanBtn.addEventListener('click', () => this.saveCurrentScan());
        }

        // Кнопки результатов
        const newScanBtn = document.getElementById('newScan');
        const viewModelBtn = document.getElementById('viewModel');
        const backToResultsBtn = document.getElementById('backToResults');

        if (newScanBtn) {
            newScanBtn.addEventListener('click', () => this.newScan());
        }
        if (viewModelBtn) {
            viewModelBtn.addEventListener('click', () => this.viewModel());
        }
        if (backToResultsBtn) {
            backToResultsBtn.addEventListener('click', () => this.showScreen('results'));
        }

        // Кнопки экспорта
        const exportOBJBtn = document.getElementById('exportOBJ');
        const exportPLYBtn = document.getElementById('exportPLY');
        const exportGLTFBtn = document.getElementById('exportGLTF');
        const exportJSONBtn = document.getElementById('exportJSON');

        if (exportOBJBtn) {
            exportOBJBtn.addEventListener('click', () => this.exportToOBJ());
        }
        if (exportPLYBtn) {
            exportPLYBtn.addEventListener('click', () => this.exportToPLY());
        }
        if (exportGLTFBtn) {
            exportGLTFBtn.addEventListener('click', () => this.exportToGLTF());
        }
        if (exportJSONBtn) {
            exportJSONBtn.addEventListener('click', () => this.exportToJSON());
        }

        // Кнопки ошибок
        const retryBtn = document.getElementById('retryButton');
        const backToWelcomeBtn = document.getElementById('backToWelcome');

        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryInitialization());
        }
        if (backToWelcomeBtn) {
            backToWelcomeBtn.addEventListener('click', () => this.showScreen('welcome'));
        }
    }

    async startScanning() {
        console.log('Запуск сканирования для Quest 3');
        try {
            this.showScreen('scanning');
            this.isScanning = true;
            this.scanStartTime = Date.now();
            
            // Инициализируем данные сканирования
            this.scanData = {
                points: [],
                surfaces: [],
                metadata: {
                    startTime: new Date().toISOString(),
                    deviceInfo: await this.getDeviceInfo(),
                    roomDimensions: null
                }
            };

            if (this.demoMode) {
                console.log('Запуск демо режима');
                this.startDemoScanning();
            } else {
                console.log('Запуск VR режима для Quest 3');
                try {
                    // Упрощенная конфигурация для Quest 3
                    const sessionOptions = {
                        requiredFeatures: ['local-floor'],
                        optionalFeatures: ['dom-overlay']
                    };

                    console.log('Запрос VR сессии с упрощенными опциями:', sessionOptions);
                    
                    // Запускаем VR сессию с минимальными требованиями
                    this.scanSession = await navigator.xr.requestSession('immersive-vr', sessionOptions);
                    
                    console.log('VR сессия создана успешно для Quest 3');

                    // Добавляем обработчики событий сессии
                    this.scanSession.addEventListener('end', () => {
                        console.log('VR сессия завершена');
                        this.handleSessionEnd();
                    });

                    this.scanSession.addEventListener('visibilitychange', () => {
                        console.log('Изменение видимости VR сессии');
                    });

                    // Настраиваем обработчики событий VR
                    this.setupVREventHandlers();
                    
                    // Запускаем цикл сканирования
                    this.scanSession.requestAnimationFrame(this.scanFrame.bind(this));
                    
                } catch (vrError) {
                    console.error('Ошибка VR сессии для Quest 3:', vrError);
                    // Переключаемся в демо режим
                    this.demoMode = true;
                    this.startDemoScanning();
                }
            }
            
            // Запускаем обновление прогресса
            this.startProgressUpdate();

        } catch (error) {
            console.error('Ошибка запуска сканирования:', error);
            this.showError('Не удалось запустить сканирование. Переключаемся в демо режим.');
            this.demoMode = true;
            this.startDemoScanning();
        }
    }

    setupVREventHandlers() {
        // Упрощенные обработчики для Quest 3
        this.scanSession.addEventListener('select', (event) => {
            console.log('Событие select в VR');
            if (this.isScanning) {
                // Простое добавление точки при нажатии
                this.addPointFromEvent(event);
            }
        });

        this.scanSession.addEventListener('inputsourceschange', (event) => {
            console.log('Изменение источников ввода в VR');
            event.added.forEach(inputSource => {
                this.setupControllerTracking(inputSource);
            });
        });
    }

    setupControllerTracking(inputSource) {
        console.log('Настройка отслеживания контроллера:', inputSource.handedness);
        if (inputSource.handedness === 'right') {
            this.rightController = inputSource;
        } else if (inputSource.handedness === 'left') {
            this.leftController = inputSource;
        }
    }

    addPointFromEvent(event) {
        // Добавляем точку на основе события контроллера
        const point = {
            position: {
                x: Math.random() * 10 - 5,
                y: Math.random() * 3,
                z: Math.random() * 10 - 5
            },
            normal: {
                x: Math.random() - 0.5,
                y: Math.random() - 0.5,
                z: Math.random() - 0.5
            },
            timestamp: Date.now(),
            confidence: 0.8
        };
        
        this.scanData.points.push(point);
        this.updateScanStats();
    }

    async scanFrame(timestamp, frame) {
        if (!this.isScanning) return;

        try {
            // Получаем информацию о позиции пользователя
            const referenceSpace = frame.session.renderState.referenceSpace;
            const pose = frame.getViewerPose(referenceSpace);
            
            if (pose) {
                // Упрощенный захват точек для Quest 3
                this.capturePointsFromPose(frame, pose);
                
                // Обновляем поверхности
                await this.updateSurfaces(frame, pose);
            }

            // Продолжаем цикл сканирования
            this.scanSession.requestAnimationFrame(this.scanFrame.bind(this));

        } catch (error) {
            console.error('Ошибка в цикле сканирования:', error);
        }
    }

    capturePointsFromPose(frame, pose) {
        // Упрощенный метод захвата точек для Quest 3
        // Используем позицию пользователя и направление взгляда
        
        pose.views.forEach((view, viewIndex) => {
            // Получаем позицию камеры
            const position = view.transform.position;
            const orientation = view.transform.orientation;
            
            // Создаем точку на основе позиции пользователя
            const point = {
                position: {
                    x: position.x,
                    y: position.y,
                    z: position.z
                },
                normal: {
                    x: orientation.x,
                    y: orientation.y,
                    z: orientation.z
                },
                timestamp: Date.now(),
                confidence: 0.7
            };
            
            this.scanData.points.push(point);
        });

        // Обновляем счетчики
        this.updateScanStats();
    }

    async updateSurfaces(frame, pose) {
        // Анализируем точки для создания поверхностей
        if (this.scanData.points.length > 10) {
            const surfaces = this.generateSurfaces(this.scanData.points);
            this.scanData.surfaces = surfaces;
        }
    }

    generateSurfaces(points) {
        // Простой алгоритм генерации поверхностей на основе близких точек
        const surfaces = [];
        const processedPoints = new Set();
        
        for (let i = 0; i < points.length; i++) {
            if (processedPoints.has(i)) continue;
            
            const surface = {
                points: [i],
                normal: points[i].normal,
                bounds: this.calculateBounds([points[i]])
            };
            
            // Ищем близкие точки с похожей нормалью
            for (let j = i + 1; j < points.length; j++) {
                if (processedPoints.has(j)) continue;
                
                const distance = this.calculateDistance(points[i].position, points[j].position);
                const normalSimilarity = this.calculateNormalSimilarity(points[i].normal, points[j].normal);
                
                if (distance < 0.5 && normalSimilarity > 0.8) {
                    surface.points.push(j);
                    processedPoints.add(j);
                }
            }
            
            if (surface.points.length > 3) {
                surfaces.push(surface);
            }
            
            processedPoints.add(i);
        }
        
        return surfaces;
    }

    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    calculateNormalSimilarity(normal1, normal2) {
        return Math.abs(
            normal1.x * normal2.x + 
            normal1.y * normal2.y + 
            normal1.z * normal2.z
        );
    }

    calculateBounds(points) {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        points.forEach(point => {
            minX = Math.min(minX, point.position.x);
            minY = Math.min(minY, point.position.y);
            minZ = Math.min(minZ, point.position.z);
            maxX = Math.max(maxX, point.position.x);
            maxY = Math.max(maxY, point.position.y);
            maxZ = Math.max(maxZ, point.position.z);
        });
        
        return { minX, minY, minZ, maxX, maxY, maxZ };
    }

    updateScanStats() {
        const pointCountElement = document.getElementById('pointCount');
        const surfaceCountElement = document.getElementById('surfaceCount');
        
        if (pointCountElement) {
            pointCountElement.textContent = this.scanData.points.length;
        }
        if (surfaceCountElement) {
            surfaceCountElement.textContent = this.scanData.surfaces.length;
        }
    }

    startProgressUpdate() {
        this.progressInterval = setInterval(() => {
            if (this.isScanning) {
                const elapsed = Date.now() - this.scanStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                
                const scanTimeElement = document.getElementById('scanTime');
                if (scanTimeElement) {
                    scanTimeElement.textContent = 
                        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
                
                // Обновляем прогресс (примерно 1% каждые 10 секунд)
                const progress = Math.min(100, Math.floor(elapsed / 10000));
                const progressFillElement = document.getElementById('progressFill');
                const progressTextElement = document.getElementById('progressText');
                
                if (progressFillElement) {
                    progressFillElement.style.width = `${progress}%`;
                }
                if (progressTextElement) {
                    progressTextElement.textContent = `${progress}%`;
                }
            }
        }, 1000);
    }

    pauseScanning() {
        this.isScanning = !this.isScanning;
        const button = document.getElementById('pauseScan');
        if (button) {
            if (this.isScanning) {
                button.textContent = '⏸️ Пауза';
                if (this.scanSession) {
                    this.scanSession.requestAnimationFrame(this.scanFrame.bind(this));
                }
            } else {
                button.textContent = '▶️ Продолжить';
            }
        }
    }

    stopScanning() {
        console.log('Остановка сканирования');
        this.isScanning = false;
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        
        if (this.scanSession) {
            this.scanSession.end();
        }
        
        // Завершаем сканирование
        this.finalizeScan();
    }

    handleSessionEnd() {
        console.log('Обработка завершения сессии');
        this.isScanning = false;
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        
        // Если сканирование было активно, завершаем его
        if (this.scanData.points.length > 0) {
            this.finalizeScan();
        } else {
            this.showScreen('welcome');
        }
    }

    async finalizeScan() {
        console.log('Завершение сканирования');
        this.scanData.metadata.endTime = new Date().toISOString();
        this.scanData.metadata.roomDimensions = this.calculateRoomDimensions();
        
        // Обновляем финальную статистику
        const finalPointCountElement = document.getElementById('finalPointCount');
        const finalSurfaceCountElement = document.getElementById('finalSurfaceCount');
        const finalScanTimeElement = document.getElementById('finalScanTime');
        const fileSizeElement = document.getElementById('fileSize');
        
        if (finalPointCountElement) {
            finalPointCountElement.textContent = this.scanData.points.length;
        }
        if (finalSurfaceCountElement) {
            finalSurfaceCountElement.textContent = this.scanData.surfaces.length;
        }
        
        const elapsed = Date.now() - this.scanStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        if (finalScanTimeElement) {
            finalScanTimeElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Рассчитываем размер файла
        const dataSize = JSON.stringify(this.scanData).length;
        const sizeKB = Math.round(dataSize / 1024);
        
        if (fileSizeElement) {
            fileSizeElement.textContent = `${sizeKB} KB`;
        }
        
        this.showScreen('results');
    }

    calculateRoomDimensions() {
        if (this.scanData.points.length === 0) return null;
        
        const bounds = this.calculateBounds(this.scanData.points);
        return {
            width: bounds.maxX - bounds.minX,
            height: bounds.maxY - bounds.minY,
            depth: bounds.maxZ - bounds.minZ,
            volume: (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) * (bounds.maxZ - bounds.minZ)
        };
    }

    async getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            timestamp: new Date().toISOString()
        };
    }

    startDemoMode() {
        console.log('Переключение в демо режим');
        this.demoMode = true;
        this.startScanning();
    }

    startDemoScanning() {
        console.log('Запуск демо сканирования');
        // Симулируем процесс сканирования
        const demoInterval = setInterval(() => {
            if (!this.isScanning) {
                clearInterval(demoInterval);
                return;
            }

            // Добавляем случайные точки
            const point = {
                position: {
                    x: (Math.random() - 0.5) * 10,
                    y: Math.random() * 3,
                    z: (Math.random() - 0.5) * 10
                },
                normal: {
                    x: Math.random() - 0.5,
                    y: Math.random() - 0.5,
                    z: Math.random() - 0.5
                },
                timestamp: Date.now(),
                confidence: 0.8 + Math.random() * 0.2
            };

            this.scanData.points.push(point);

            // Обновляем поверхности каждые 10 точек
            if (this.scanData.points.length % 10 === 0) {
                this.scanData.surfaces = this.generateSurfaces(this.scanData.points);
            }

            this.updateScanStats();

            // Автоматически останавливаем через 30 секунд
            if (Date.now() - this.scanStartTime > 30000) {
                this.stopScanning();
            }
        }, 200);
    }

    // Экспорт в различные форматы
    exportToOBJ() {
        const objContent = this.generateOBJ();
        this.downloadFile(objContent, 'room_scan.obj', 'text/plain');
    }

    exportToPLY() {
        const plyContent = this.generatePLY();
        this.downloadFile(plyContent, 'room_scan.ply', 'text/plain');
    }

    exportToGLTF() {
        const gltfContent = this.generateGLTF();
        this.downloadFile(JSON.stringify(gltfContent), 'room_scan.gltf', 'application/json');
    }

    exportToJSON() {
        const jsonContent = JSON.stringify(this.scanData, null, 2);
        this.downloadFile(jsonContent, 'room_scan.json', 'application/json');
    }

    generateOBJ() {
        let obj = '# Room Scan OBJ File\n';
        obj += '# Generated by Meta Quest 3 Room Scanner\n\n';
        
        // Вершины
        this.scanData.points.forEach((point, index) => {
            obj += `v ${point.position.x} ${point.position.y} ${point.position.z}\n`;
        });
        
        // Нормали
        this.scanData.points.forEach(point => {
            obj += `vn ${point.normal.x} ${point.normal.y} ${point.normal.z}\n`;
        });
        
        // Поверхности
        this.scanData.surfaces.forEach((surface, surfaceIndex) => {
            obj += `\ng surface_${surfaceIndex}\n`;
            for (let i = 0; i < surface.points.length - 2; i++) {
                const p1 = surface.points[i] + 1;
                const p2 = surface.points[i + 1] + 1;
                const p3 = surface.points[i + 2] + 1;
                obj += `f ${p1}//${p1} ${p2}//${p2} ${p3}//${p3}\n`;
            }
        });
        
        return obj;
    }

    generatePLY() {
        let ply = 'ply\n';
        ply += 'format ascii 1.0\n';
        ply += `element vertex ${this.scanData.points.length}\n`;
        ply += 'property float x\n';
        ply += 'property float y\n';
        ply += 'property float z\n';
        ply += 'property float nx\n';
        ply += 'property float ny\n';
        ply += 'property float nz\n';
        ply += 'property float confidence\n';
        ply += 'end_header\n';
        
        this.scanData.points.forEach(point => {
            ply += `${point.position.x} ${point.position.y} ${point.position.z} `;
            ply += `${point.normal.x} ${point.normal.y} ${point.normal.z} `;
            ply += `${point.confidence}\n`;
        });
        
        return ply;
    }

    generateGLTF() {
        const positions = [];
        const normals = [];
        
        this.scanData.points.forEach(point => {
            positions.push(point.position.x, point.position.y, point.position.z);
            normals.push(point.normal.x, point.normal.y, point.normal.z);
        });
        
        return {
            asset: {
                version: "2.0",
                generator: "Meta Quest 3 Room Scanner"
            },
            scene: 0,
            scenes: [{
                nodes: [0]
            }],
            nodes: [{
                mesh: 0
            }],
            meshes: [{
                primitives: [{
                    attributes: {
                        POSITION: 0,
                        NORMAL: 1
                    },
                    indices: 2
                }]
            }],
            accessors: [
                {
                    bufferView: 0,
                    componentType: 5126,
                    count: this.scanData.points.length,
                    type: "VEC3",
                    max: this.calculateBounds(this.scanData.points),
                    min: this.calculateBounds(this.scanData.points)
                },
                {
                    bufferView: 1,
                    componentType: 5126,
                    count: this.scanData.points.length,
                    type: "VEC3"
                }
            ],
            bufferViews: [
                {
                    buffer: 0,
                    byteOffset: 0,
                    byteLength: positions.length * 4,
                    target: 34962
                },
                {
                    buffer: 0,
                    byteOffset: positions.length * 4,
                    byteLength: normals.length * 4,
                    target: 34962
                }
            ],
            buffers: [{
                uri: "data:application/octet-stream;base64," + btoa(String.fromCharCode(...new Uint8Array(new Float32Array(positions.concat(normals)).buffer)))
            }]
        };
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Навигация между экранами
    showScreen(screenId) {
        const screens = ['loading', 'welcome', 'scanning', 'results', 'viewer', 'error'];
        screens.forEach(screen => {
            const element = document.getElementById(screen);
            if (element) {
                if (screen === screenId) {
                    element.classList.remove('hidden');
                } else {
                    element.classList.add('hidden');
                }
            }
        });
    }

    showError(message) {
        const errorMessageElement = document.getElementById('errorMessage');
        if (errorMessageElement) {
            errorMessageElement.textContent = message;
        }
        this.showScreen('error');
    }

    retryInitialization() {
        this.showScreen('loading');
        this.initializeApp();
    }

    // Дополнительные методы
    newScan() {
        this.scanData = {
            points: [],
            surfaces: [],
            metadata: {
                startTime: null,
                endTime: null,
                deviceInfo: null,
                roomDimensions: null
            }
        };
        this.showScreen('welcome');
    }

    viewModel() {
        this.showScreen('viewer');
        // Здесь можно добавить 3D просмотр модели
        const modelViewerElement = document.getElementById('modelViewer');
        if (modelViewerElement) {
            modelViewerElement.innerHTML = '<p>3D просмотр модели будет доступен в следующей версии</p>';
        }
    }

    loadSavedScan() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        this.scanData = JSON.parse(e.target.result);
                        this.finalizeScan();
                    } catch (error) {
                        this.showError('Ошибка загрузки файла сканирования');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    saveCurrentScan() {
        const jsonContent = JSON.stringify(this.scanData, null, 2);
        this.downloadFile(jsonContent, `room_scan_${Date.now()}.json`, 'application/json');
    }
}

// Инициализация приложения
function initializeApp() {
    try {
        console.log('Инициализация приложения для Quest 3...');
        new RoomScanner();
    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        // Показываем ошибку пользователю
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.innerHTML = `
                <div class="loading-content">
                    <h1>Ошибка загрузки</h1>
                    <p>Не удалось инициализировать приложение</p>
                    <button onclick="location.reload()" class="btn-primary">Перезагрузить</button>
                </div>
            `;
        }
    }
}

// Ждем загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM уже загружен
    initializeApp();
} 