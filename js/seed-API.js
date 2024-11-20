//seed API.js
//este archivo genera una cantidad de x archivos de semillas en la carpeta seed

const fs = require("fs");
const path = require("path");
const Perlin = require("perlin-noise"); // Usa una librería de ruido como 'perlin-noise'

// Configuración básica
const SEED_FOLDER = path.join(__dirname, "seed");
const STRUCTURES_FOLDER = path.join(__dirname, "structures");

// Crear semillas
function createSeedFiles(seedCount, seedSize, noiseScale = 0.1) {
    // Asegúrate de que las carpetas existan
    if (!fs.existsSync(SEED_FOLDER)) fs.mkdirSync(SEED_FOLDER, { recursive: true });
    if (!fs.existsSync(STRUCTURES_FOLDER)) {
        throw new Error("La carpeta 'structures' no existe. Agrega estructuras antes de usar esta API.");
    }

    // Generar ruido para cada semilla
    for (let i = 0; i < seedCount; i++) {
        const terrain = generateNoiseTerrain(seedSize, seedSize, noiseScale);
        const seedFileName = `seed_${i}.txt`;  // Corregido
        const seedFilePath = path.join(SEED_FOLDER, seedFileName);

        // Insertar estructuras aleatoriamente en el terreno
        const terrainWithStructures = addStructuresToTerrain(terrain);

        // Guardar la semilla en un archivo
        saveTerrainToFile(seedFilePath, terrainWithStructures);
        console.log(`Semilla generada: ${seedFileName}`);
    }
}

// Generar terreno basado en ruido
function generateNoiseTerrain(width, height, scale) {
    const noise = Perlin.generatePerlinNoise(width, height, { octaveCount: 4, amplitude: 0.5, persistence: 0.5 });
    return noise.map((value) => Math.round(value * 5)); // Alturas entre 0 y 5
}

// Añadir estructuras al terreno
function addStructuresToTerrain(terrain) {
    const structures = loadStructures();
    const width = terrain.length;
    const height = terrain[0].length;
    const minDistance = 10; // Distancia mínima entre estructuras
    const structureAreas = generateStructureAreas(width, height); // Zonas designadas para las estructuras

    structures.forEach((structure) => {
        let placed = false;
        // Probabilidad de aparición: 80% para naturales, 20% para artificiales
        const probabilidad = structure.tipo === "natural" ? 0.8 : 0.2;

        while (!placed) {
            // Generamos un número aleatorio para decidir si se coloca la estructura
            if (Math.random() < probabilidad) {
                // Seleccionar una zona aleatoria dentro de las áreas permitidas
                const area = structureAreas[Math.floor(Math.random() * structureAreas.length)];
                const startX = area.x + Math.floor(Math.random() * (area.width - structure.data[0].length));
                const startY = area.y + Math.floor(Math.random() * (area.height - structure.data.length));

                // Comprobar si la estructura puede colocarse sin superponerse a otras estructuras
                if (canPlaceStructure(terrain, structure.data, startX, startY, minDistance)) {
                    // Colocar la estructura
                    for (let y = 0; y < structure.data.length; y++) {
                        for (let x = 0; x < structure.data[y].length; x++) {
                            if (structure.data[y][x] !== 0) { // Si el bloque de la estructura no es aire
                                terrain[startY + y][startX + x] = structure.data[y][x];
                            }
                        }
                    }
                    placed = true;
                }
            } else {
                placed = true; // Si no se coloca, termina el ciclo
            }
        }
    });

    return terrain;
}

// Generar áreas donde se pueden colocar estructuras
function generateStructureAreas(width, height) {
    const areas = [];
    const areaCount = 5; // Definir cuántas áreas queremos para las estructuras

    for (let i = 0; i < areaCount; i++) {
        const areaWidth = Math.floor(Math.random() * (width / 3)) + 5;
        const areaHeight = Math.floor(Math.random() * (height / 3)) + 5;
        const areaX = Math.floor(Math.random() * (width - areaWidth));
        const areaY = Math.floor(Math.random() * (height - areaHeight));

        areas.push({ x: areaX, y: areaY, width: areaWidth, height: areaHeight });
    }

    return areas;
}

// Verificar si se puede colocar la estructura sin que se sobreponga a otras
function canPlaceStructure(terrain, structure, startX, startY, minDistance) {
    const width = terrain.length;
    const height = terrain[0].length;

    for (let y = 0; y < structure.length; y++) {
        for (let x = 0; x < structure[y].length; x++) {
            if (structure[y][x] !== 0) { // Si es un bloque de la estructura
                // Comprobar si la posición está fuera de los límites
                if (startX + x < 0 || startY + y < 0 || startX + x >= width || startY + y >= height) {
                    return false;
                }

                // Comprobar si el área está ocupada por otra estructura dentro del rango mínimo
                for (let dy = -minDistance; dy <= minDistance; dy++) {
                    for (let dx = -minDistance; dx <= minDistance; dx++) {
                        if (startY + y + dy >= 0 && startX + x + dx >= 0 &&
                            startY + y + dy < height && startX + x + dx < width &&
                            terrain[startY + y + dy][startX + x + dx] !== 0) {
                            return false;
                        }
                    }
                }
            }
        }
    }
    return true;
}

// Cargar estructuras desde la carpeta 'structures'
function loadStructures() {
    const structureFiles = fs.readdirSync(STRUCTURES_FOLDER);
    return structureFiles.map((file) => {
        try {
            const structureData = fs.readFileSync(path.join(STRUCTURES_FOLDER, file), "utf8");
            const tipo = file.includes("casa") || file.includes("biblioteca") ? "artificial" : "natural";
            return {
                tipo: tipo,
                data: structureData.split("\n").map((line) => line.split("").map(Number))
            };
        } catch (error) {
            console.error(`Error loading structure from ${file}: ${error.message}`);
            return null; // O manejar el error de otra manera
        }
    }).filter(Boolean); // Filtrar valores nulos
}

// Guardar terreno en un archivo
function saveTerrainToFile(filePath, terrain) {
    const content = terrain.map((row) => row.join("")).join("\n");
    fs.writeFileSync(filePath, content);
}

module.exports = { createSeedFiles };
