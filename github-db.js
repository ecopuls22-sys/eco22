// github-db.js
class GitHubDB {
    constructor() {
        this.user = document.getElementById('githubUser')?.value;
        this.repo = document.getElementById('githubRepo')?.value;
        this.token = document.getElementById('githubToken')?.value;
        
        this.data = {
            objects: [],
            metadata: {
                lastUpdate: null,
                totalObjects: 0,
                city: "Бийск",
                created: new Date().toISOString().split('T')[0]
            }
        };
        
        this.localStorageKey = 'biysk-green-backup';
        this.isOnline = navigator.onLine;
        
        console.log('GitHub DB initialized:', {
            user: this.user,
            repo: this.repo,
            hasToken: !!this.token,
            online: this.isOnline
        });
    }
    
    // Основной метод инициализации
    async init() {
        console.log('Starting database initialization...');
        
        // Загружаем локальную копию
        this.loadFromLocal();
        
        // Если есть интернет и токен - синхронизируем с GitHub
        if (this.isOnline && this.token) {
            try {
                await this.loadFromGitHub();
                console.log('Successfully synced with GitHub');
                this.updateSyncStatus('success', 'Синхронизировано с GitHub');
            } catch (error) {
                console.warn('GitHub sync failed, using local data:', error.message);
                this.updateSyncStatus('error', 'Оффлайн режим');
            }
        } else {
            console.log('Working in offline mode');
            this.updateSyncStatus('offline', 'Оффлайн режим');
        }
        
        return this.data.objects;
    }
    
    // Загрузка из GitHub
    async loadFromGitHub() {
        if (!this.token) {
            throw new Error('GitHub token not configured');
        }
        
        const url = `https://api.github.com/repos/${this.user}/${this.repo}/contents/data.json`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`GitHub API: ${response.status}`);
            }
            
            const fileData = await response.json();
            const content = atob(fileData.content); // Декодируем base64
            const remoteData = JSON.parse(content);
            
            // Объединяем локальные и удаленные данные
            this.mergeData(remoteData);
            
            // Сохраняем локально
            this.saveToLocal();
            
            this.data.metadata.lastUpdate = new Date().toISOString();
            
            return this.data.objects;
            
        } catch (error) {
            console.error('GitHub load error:', error);
            throw error;
        }
    }
    
    // Сохранение в GitHub
    async saveToGitHub() {
        if (!this.token || !this.isOnline) {
            console.log('Skipping GitHub save - no token or offline');
            return false;
        }
        
        // Обновляем метаданные
        this.data.metadata.lastUpdate = new Date().toISOString();
        this.data.metadata.totalObjects = this.data.objects.length;
        
        const url = `https://api.github.com/repos/${this.user}/${this.repo}/contents/data.json`;
        
        try {
            // 1. Получаем текущий файл чтобы узнать SHA
            let sha = null;
            try {
                const getResponse = await fetch(url, {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (getResponse.ok) {
                    const fileData = await getResponse.json();
                    sha = fileData.sha;
                }
            } catch (e) {
                console.log('No existing file, will create new');
            }
            
            // 2. Подготавливаем данные
            const content = btoa(JSON.stringify(this.data, null, 2));
            const message = `Обновление базы: ${new Date().toLocaleString()} (${this.data.objects.length} объектов)`;
            
            // 3. Отправляем на GitHub
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    content: content,
                    sha: sha // Если null - создаст новый файл
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub save error: ${errorData.message}`);
            }
            
            console.log('Successfully saved to GitHub');
            this.updateSyncStatus('success', 'Сохранено в GitHub');
            return true;
            
        } catch (error) {
            console.error('GitHub save failed:', error);
            this.updateSyncStatus('error', 'Ошибка синхронизации');
            return false;
        }
    }
    
    // Объединение данных (простая логика)
    mergeData(remoteData) {
        // Если удаленных объектов больше - используем их
        if (remoteData.objects.length > this.data.objects.length) {
            this.data.objects = remoteData.objects;
        }
        
        // Обновляем метаданные
        if (remoteData.metadata) {
            this.data.metadata = {
                ...this.data.metadata,
                ...remoteData.metadata
            };
        }
    }
    
    // Локальное сохранение
    saveToLocal() {
        try {
            localStorage.setItem(this.localStorageKey, JSON.stringify(this.data));
            console.log('Saved to local storage:', this.data.objects.length, 'objects');
        } catch (error) {
            console.error('Local storage error:', error);
        }
    }
    
    // Локальная загрузка
    loadFromLocal() {
        try {
            const saved = localStorage.getItem(this.localStorageKey);
            if (saved) {
                this.data = JSON.parse(saved);
                console.log('Loaded from local storage:', this.data.objects.length, 'objects');
            }
        } catch (error) {
            console.error('Local storage load error:', error);
        }
    }
    
    // CRUD операции
    async addObject(objectData) {
        const newObject = {
            id: this.generateId(),
            ...objectData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        this.data.objects.push(newObject);
        
        // Локальное сохранение
        this.saveToLocal();
        
        // Пробуем синхронизировать с GitHub
        if (this.isOnline) {
            await this.saveToGitHub().catch(e => {
                console.warn('GitHub sync failed after add:', e.message);
            });
        }
        
        return newObject;
    }
    
    async deleteObject(id) {
        const index = this.data.objects.findIndex(obj => obj.id === id);
        if (index === -1) return false;
        
        this.data.objects.splice(index, 1);
        
        // Локальное сохранение
        this.saveToLocal();
        
        // Пробуем синхронизировать с GitHub
        if (this.isOnline) {
            await this.saveToGitHub().catch(e => {
                console.warn('GitHub sync failed after delete:', e.message);
            });
        }
        
        return true;
    }
    
    async updateObject(id, updates) {
        const index = this.data.objects.findIndex(obj => obj.id === id);
        if (index === -1) return null;
        
        this.data.objects[index] = {
            ...this.data.objects[index],
            ...updates,
            updated_at: new Date().toISOString()
        };
        
        // Локальное сохранение
        this.saveToLocal();
        
        // Пробуем синхронизировать с GitHub
        if (this.isOnline) {
            await this.saveToGitHub().catch(e => {
                console.warn('GitHub sync failed after update:', e.message);
            });
        }
        
        return this.data.objects[index];
    }
    
    // Вспомогательные методы
    generateId() {
        return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    getAllObjects() {
        return [...this.data.objects];
    }
    
    getObjectsByType(type) {
        return this.data.objects.filter(obj => obj.type === type);
    }
    
    getStatistics() {
        return {
            total: this.data.objects.length,
            byType: {
                tree: this.getObjectsByType('tree').length,
                lawn: this.getObjectsByType('lawn').length,
                bush: this.getObjectsByType('bush').length
            },
            lastUpdate: this.data.metadata.lastUpdate
        };
    }
    
    // Экспорт данных
    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        return URL.createObjectURL(blob);
    }
    
    // Импорт данных
    importData(jsonData) {
        try {
            const importedData = JSON.parse(jsonData);
            
            if (importedData.objects && Array.isArray(importedData.objects)) {
                // Добавляем новые объекты с новыми ID
                importedData.objects.forEach(obj => {
                    if (!this.data.objects.some(existing => existing.id === obj.id)) {
                        this.data.objects.push({
                            ...obj,
                            id: this.generateId()
                        });
                    }
                });
                
                this.saveToLocal();
                
                if (this.isOnline) {
                    this.saveToGitHub().catch(console.error);
                }
                
                return importedData.objects.length;
            }
        } catch (error) {
            console.error('Import error:', error);
            throw error;
        }
    }
    
    // Обновление статуса синхронизации
    updateSyncStatus(status, message = '') {
        const statusEl = document.getElementById('syncStatus');
        if (!statusEl) return;
        
        let icon = 'cloud';
        let color = '#666';
        
        switch(status) {
            case 'success':
                icon = 'cloud-check';
                color = '#4CAF50';
                break;
            case 'error':
                icon = 'cloud-exclamation';
                color = '#f44336';
                break;
            case 'offline':
                icon = 'cloud-slash';
                color = '#FF9800';
                break;
            case 'syncing':
                icon = 'cloud-arrow-up';
                color = '#2196F3';
                break;
        }
        
        statusEl.innerHTML = `<i class="fas fa-${icon}" style="color: ${color};" title="${message}"></i>`;
    }
}

// Создаем глобальный экземпляр
const greenDB = new GitHubDB();
window.greenDB = greenDB;