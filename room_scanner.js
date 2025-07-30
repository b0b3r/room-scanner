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
        // Показываем загрузку
        this.showScreen('loading');
        this.updateLoadingStatus('Проверка поддержки WebXR...');
        
        try {
            // Проверяем поддержку WebXR
            if (!navigator.xr) {
                this.updateLoadingStatus('WebXR не поддерживается, переключаемся в демо режим...');
                await this.delay(1000);
                this.demoMode = true;
                this.setupEventListeners();
                this.showScreen('welcome');
                return;
            }

            this.updateLoadingStatus('Проверка поддержки VR...');
            await this.delay(500);

            // Проверяем доступность VR
            const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
            if (!isSupported) {
                this.updateLoadingStatus('VR не поддерживается, переключаемся в демо режим...');
                await this.delay(1000);
                this.demoMode = true;
            } else {
                this.updateLoadingStatus('WebXR поддерживается!');
                await this.delay(500);
            }

            // Инициализируем приложение
            this.setupEventListeners();
            this.showScreen('welcome');
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
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
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setupEventListeners() {
        // Кнопки на экране приветствия
        document.getElementById('startScan').addEventListener('click', () => this.startScanning());
        document.getElementById('loadScan').addEventListener('click', () => this.loadSavedScan());
        document.getElementById('demoMode').addEventListener('click', () => this.startDemoMode());

        // Кнопки управления сканированием
        document.getElementById('pauseScan').addEventListener('click', () => this.pauseScanning());
        document.getElementById('stopScan').addEventListener('click', () => this.stopScanning());
        document.getElementById('saveScan').addEventListener('click', () => this.saveCurrentScan());

        // Кнопки результатов
        document.getElementById('newScan').addEventListener('click', () => this.newScan());
        document.getElementById('viewModel').addEventListener('click', () => this.viewModel());
        document.getElementById('backToResults').addEventListener('click', () => this.showScreen('results'));

        // Кнопки экспорта
        document.getElementById('exportOBJ').addEventListener('click', () => this.exportToOBJ());
        document.getElementById('exportPLY').addEventListener('click', () => this.exportToPLY());
        document.getElementById('exportGLTF').addEventListener('click', () => this.exportToGLTF());
        document.getElementById('exportJSON').addEventListener('click', () => this.exportToJSON());

        // Кнопки ошибок
        document.getElementById('retryButton').addEventListener('click', () => this.retryInitialization());
        document.getElementById('backToWelcome').addEventListener('click', () => this.showScreen('welcome'));
    }

    async startScanning() {
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
                // Демо режим - симулируем сканирование
                this.startDemoScanning();
            } else {
                // Реальный VR режим
                try {
                    // Запускаем VR сессию
                    this.scanSession = await navigator.xr.requestSession('immersive-vr', {
                        requiredFeatures: ['local-floor', 'hit-test', 'anchors'],
                        optionalFeatures: ['dom-overlay'],
                        domOverlay: { root: document.getElementById('scanning') }
                    });

                    // Настраиваем обработчики событий VR
                    this.setupVREventHandlers();
                    
                    // Запускаем цикл сканирования
                    this.scanSession.requestAnimationFrame(this.scanFrame.bind(this));
                } catch (vrError) {
                    console.error('Ошибка VR сессии:', vrError);
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

    startDemoMode() {
        this.demoMode = true;
        this.startScanning();
    }

    startDemoScanning() {
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

    setupVREventHandlers() {
        // Обработчик нажатий контроллеров
        this.scanSession.addEventListener('select', (event) => {
            if (this.isScanning) {
                this.capturePoint(event.frame, event.inputSource);
            }
        });

        // Обработчик движения контроллеров
        this.scanSession.addEventListener('inputsourceschange', (event) => {
            event.added.forEach(inputSource => {
                this.setupControllerTracking(inputSource);
            });
        });
    }

    setupControllerTracking(inputSource) {
        // Настраиваем отслеживание контроллеров для сканирования
        if (inputSource.handedness === 'right') {
            // Правый контроллер для активного сканирования
            this.rightController = inputSource;
        } else if (inputSource.handedness === 'left') {
            // Левый контроллер для навигации
            this.leftController = inputSource;
        }
    }

    async scanFrame(timestamp, frame) {
        if (!this.isScanning) return;

        try {
            // Получаем информацию о позиции пользователя
            const referenceSpace = frame.session.renderState.referenceSpace;
            const pose = frame.getViewerPose(referenceSpace);
            
            if (pose) {
                // Захватываем точки сканирования
                await this.captureScanPoints(frame, pose);
                
                // Обновляем поверхности
                await this.updateSurfaces(frame, pose);
            }

            // Продолжаем цикл сканирования
            this.scanSession.requestAnimationFrame(this.scanFrame.bind(this));

        } catch (error) {
            console.error('Ошибка в цикле сканирования:', error);
        }
    }

    async captureScanPoints(frame, pose) {
        // Используем hit-test для определения поверхностей
        const hitTestSource = await frame.session.requestHitTestSource({ space: pose.views[0].space });
        
        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            
            hitTestResults.forEach(hit => {
                const point = {
                    position: {
                        x: hit.hitMatrix[12],
                        y: hit.hitMatrix[13],
                        z: hit.hitMatrix[14]
                    },
                    normal: this.extractNormal(hit.hitMatrix),
                    timestamp: Date.now(),
                    confidence: this.calculateConfidence(hit)
                };
                
                this.scanData.points.push(point);
            });
        }

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

    extractNormal(matrix) {
        // Извлекаем нормаль из матрицы преобразования
        return {
            x: matrix[0],
            y: matrix[1],
            z: matrix[2]
        };
    }

    calculateConfidence(hit) {
        // Простая оценка уверенности на основе расстояния
        return Math.max(0, 1 - hit.distance / 10);
    }

    updateScanStats() {
        document.getElementById('pointCount').textContent = this.scanData.points.length;
        document.getElementById('surfaceCount').textContent = this.scanData.surfaces.length;
    }

    startProgressUpdate() {
        this.progressInterval = setInterval(() => {
            if (this.isScanning) {
                const elapsed = Date.now() - this.scanStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                document.getElementById('scanTime').textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                // Обновляем прогресс (примерно 1% каждые 10 секунд)
                const progress = Math.min(100, Math.floor(elapsed / 10000));
                document.getElementById('progressFill').style.width = `${progress}%`;
                document.getElementById('progressText').textContent = `${progress}%`;
            }
        }, 1000);
    }

    pauseScanning() {
        this.isScanning = !this.isScanning;
        const button = document.getElementById('pauseScan');
        if (this.isScanning) {
            button.textContent = '⏸️ Пауза';
            this.scanSession.requestAnimationFrame(this.scanFrame.bind(this));
        } else {
            button.textContent = '▶️ Продолжить';
        }
    }

    stopScanning() {
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

    async finalizeScan() {
        this.scanData.metadata.endTime = new Date().toISOString();
        this.scanData.metadata.roomDimensions = this.calculateRoomDimensions();
        
        // Обновляем финальную статистику
        document.getElementById('finalPointCount').textContent = this.scanData.points.length;
        document.getElementById('finalSurfaceCount').textContent = this.scanData.surfaces.length;
        
        const elapsed = Date.now() - this.scanStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('finalScanTime').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Рассчитываем размер файла
        const dataSize = JSON.stringify(this.scanData).length;
        const sizeKB = Math.round(dataSize / 1024);
        document.getElementById('fileSize').textContent = `${sizeKB} KB`;
        
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
                uri: "data:application/octet-stream;base64," + btoa(String.fromCharCode(...new Uint8Array(new Float32Array(positions.concat(normals)).buffer))
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
        const screens = ['loading', 'welcome', 'scanning', 'results', 'viewer'];
        screens.forEach(screen => {
            const element = document.getElementById(screen);
            if (screen === screenId) {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        });
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
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
        document.getElementById('modelViewer').innerHTML = 
            '<p>3D просмотр модели будет доступен в следующей версии</p>';
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
document.addEventListener('DOMContentLoaded', () => {
    new RoomScanner();
});