// ==========================================
// World container
//
// This class contains the elements that make up the game world.
// Other modules retrieve information from the world or alter it
// using this class.
// ==========================================

// Constructor( sx, sy, sz )
//
// Creates a new world container with the specified world size.
// Up and down should always be aligned with the Z-direction.
//
// sx - World size in the X-direction.
// sy - World size in the Y-direction.
// sz - World size in the Z-direction.
function World(sx, sy, sz) {
    // Inicializar el array de bloques
    this.blocks = new Array(sx);
    for (let x = 0; x < sx; x++) {
        this.blocks[x] = new Array(sy);
        for (let y = 0; y < sy; y++) {
            this.blocks[x][y] = new Array(sz);
        }
    }
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;

    this.players = {};
}

// Crear un mundo plano
World.prototype.createFlatWorld = function (height) {
    this.spawnPoint = new Vector(this.sx / 2 + 0.5, this.sy / 2 + 0.5, height);

    for (let x = 0; x < this.sx; x++) {
        for (let y = 0; y < this.sy; y++) {
            for (let z = 0; z < this.sz; z++) {
                this.blocks[x][y][z] = z < height ? BLOCK.DIRT : BLOCK.AIR;
            }
        }
    }
};

// Crear un mundo predeterminado usando datos de archivos de semilla
World.prototype.createDefaultWorld = async function (centerX, centerY, centerZ) {
    this.spawnPoint = new Vector(centerX, centerY, centerZ);
    const limit = 255; // Define el límite desde el centro

    // Archivos de semilla simulados
    const seedFiles = [];
    for (let i = 0; i < 64; i++) {
        seedFiles.push(`seed/seed${i}.txt`); // Rutas relativas
    }

    const fetchPromises = seedFiles.map(async (seedURL) => {
        const response = await fetch(seedURL);
        return response.text();
    });

    // Cargar todas las semillas de forma paralela
    const seedDataArray = await Promise.all(fetchPromises);

    // Procesar las semillas y construir el mundo
    for (let x = -limit; x <= limit; x++) {
        for (let y = -limit; y <= limit; y++) {
            const seedIndex = Math.abs((x + y) % seedDataArray.length);
            const seedData = seedDataArray[seedIndex];
            const zPattern = seedData.split("\n").map((line) => line.split("").map(Number));

            for (let z = 0; z < this.sz; z++) {
                const isSolid = zPattern[x % zPattern.length]?.[y % zPattern[0].length] || 0;
                this.blocks[x + centerX][y + centerY][z] = isSolid ? BLOCK.DIRT : BLOCK.AIR;
            }
        }
    }
};

// Obtener el bloque en una posición específica
World.prototype.getBlock = function (x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return BLOCK.AIR;
    return this.blocks[x][y][z];
};

// Establecer un bloque en una posición específica
World.prototype.setBlock = function (x, y, z, type) {
    this.blocks[x][y][z] = type;
    if (this.renderer != null) this.renderer.onBlockChanged(x, y, z);
};

// Exportar para su uso en el navegador
if (typeof window !== "undefined") {
    window.World = World;
}

