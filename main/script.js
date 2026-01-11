// script.js - Основной файл с картой
let myMap;
let currentObjects = [];

async function initMap() {
    // Загружаем объекты из базы
    currentObjects = await greenDB.getAllObjects();
    
    // Создаем карту
    myMap = new ymaps.Map('map', {
        center: [52.5186, 85.2076],
        zoom: 13,
        controls: ['zoomControl', 'fullscreenControl']
    });
    
    // Добавляем объекты на карту
    currentObjects.forEach(obj => {
        addObjectToMap(obj);
    });
    
    // Инициализируем интерфейс
    initUI();
    
    // Обновляем статистику
    updateStats();
    
    console.log('Map initialized with', currentObjects.length, 'objects');
}

function addObjectToMap(obj) {
    // Логика добавления метки на карту (как в предыдущих версиях)
    // ...
}

function initUI() {
    // Кнопка добавления объекта
    document.getElementById('addObjectBtn').addEventListener('click', () => {
        showAddPanel();
    });
    
    // Кнопка сохранения
    document.getElementById('saveObjectBtn').addEventListener('click', async () => {
        await saveNewObject();
    });
    
    // Обновление статистики каждые 30 секунд
    setInterval(updateStats, 30000);
}

async function saveNewObject() {
    // Собираем данные из формы
    const objectData = {
        name: document.getElementById('objectName').value,
        type: document.getElementById('objectType').value,
        condition: document.getElementById('objectCondition').value,
        coords: [parseFloat(document.getElementById('lat').value), 
                parseFloat(document.getElementById('lon').value)],
        description: document.getElementById('objectDescription').value
    };
    
    // Добавляем в базу
    const newObject = await greenDB.addObject(objectData);
    
    // Добавляем на карту
    addObjectToMap(newObject);
    
    // Обновляем интерфейс
    updateStats();
    
    alert('Объект сохранен!');
}

function updateStats() {
    const stats = greenDB.getStatistics();
    
    // Обновляем счетчики в интерфейсе
    document.getElementById('totalCount').textContent = stats.total;
    document.getElementById('treeCount').textContent = stats.byType.tree;
    document.getElementById('lawnCount').textContent = stats.byType.lawn;
    document.getElementById('bushCount').textContent = stats.byType.bush;
}