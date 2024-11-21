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

function World( sx, sy, sz )
{
	// Initialise world array
	this.blocks = new Array( sx );
	for ( var x = 0; x < sx; x++ )
	{
		this.blocks[x] = new Array( sy );
		for ( var y = 0; y < sy; y++ )
		{
			this.blocks[x][y] = new Array( sz );
		}
	}
	this.sx = sx;
	this.sy = sy;
	this.sz = sz;
	
	this.players = {};
}

// createFlatWorld()
//
// Sets up the world so that the bottom half is filled with dirt
// and the top half with air.

World.prototype.createFlatWorld = function( height )
{
	this.spawnPoint = new Vector( this.sx / 2 + 0.5, this.sy / 2 + 0.5, height );
	
	for ( var x = 0; x < this.sx; x++ )
		for ( var y = 0; y < this.sy; y++ )
			for ( var z = 0; z < this.sz; z++ )
				this.blocks[x][y][z] = z < height ? BLOCK.DIRT : BLOCK.AIR;
}

// createFromString( str )
//
// Creates a world from a string representation.
// This is the opposite of toNetworkString().
//
// NOTE: The world must have already been created
// with the appropriate size!



function loadSeed(seedFile) {
    const data = fs.readFileSync(`js/seeds/${seedFile}`, 'utf-8');
    const lines = data.split('\n').map(line => line.trim());
    const dimensions = lines[0].split('x').map(Number);
    const structures = lines[1].split(',').map(entry => {
        const [coords, structure] = entry.split('estructura');
        return { coords: coords.match(/\d+/g).map(Number), structure };
    });
    const chunks = lines[2].split(',').map(Number);
    const caveDimensions = lines[3].split('x').map(Number);

    return { dimensions, structures, chunks, caveDimensions };
}

// Llamar loadSeed para cargar semillas dinámicamente
const seedData = loadSeed('seed_1.txt');
initializeWorld(seedData);


World.prototype.createFromString = function( str )
{
	var i = 0;
	
	for ( var x = 0; x < this.sx; x++ ) {
		for ( var y = 0; y < this.sy; y++ ) {
			for ( var z = 0; z < this.sz; z++ ) {
				this.blocks[x][y][z] = BLOCK.fromId( str.charCodeAt( i ) - 97 );
				i = i + 1;
			}
		}
	}
}

// getBlock( x, y, z )
//
// Get the type of the block at the specified position.
// Mostly for neatness, since accessing the array
// directly is easier and faster.

World.prototype.getBlock = function( x, y, z )
{
	if ( x < 0 || y < 0 || z < 0 || x > this.sx - 1 || y > this.sy - 1 || z > this.sz - 1 ) return BLOCK.AIR;
	return this.blocks[x][y][z];
}

// setBlock( x, y, z )

World.prototype.setBlock = function( x, y, z, type )
{
	this.blocks[x][y][z] = type;
	if ( this.renderer != null ) this.renderer.onBlockChanged( x, y, z );
}

// toNetworkString()
//
// Returns a string representation of this world.

World.prototype.toNetworkString = function()
{
	var blockArray = [];
	
	for ( var x = 0; x < this.sx; x++ )
		for ( var y = 0; y < this.sy; y++ )
			for ( var z = 0; z < this.sz; z++ )
				blockArray.push( String.fromCharCode( 97 + this.blocks[x][y][z].id ) );
	
	return blockArray.join( "" );
}

// Export to node.js
if ( typeof( exports ) != "undefined" )
{
	// loadFromFile( filename )
	//
	// Load a world from a file previously saved with saveToFile().
	// The world must have already been allocated with the
	// appropriate dimensions.
	
	World.prototype.loadFromFile = function( filename )
	{
		var fs = require( "fs" );
		try {
			fs.lstatSync( filename );
			var data = fs.readFileSync( filename, "utf8" ).split( "," );
			this.createFromString( data[3] );
			this.spawnPoint = new Vector( parseInt( data[0] ), parseInt( data[1] ), parseInt( data[2] ) );
			return true;
		} catch ( e ) {
			return false;
		}
	}
	
	// saveToFile( filename )
	//
	// Saves a world and the spawn point to a file.
	// The world can be loaded from it afterwards with loadFromFile().
	
	World.prototype.saveToFile = function( filename )
	{
		var data = this.spawnPoint.x + "," + this.spawnPoint.y + "," + this.spawnPoint.z + "," + this.toNetworkString();
		require( "fs" ).writeFileSync( filename, data );	
	}
	
	exports.World = World;
}
World.prototype.getBioma = function (x, y, z) {
    // Lógica para detectar el bioma. Puedes usar ruido Perlin, altura, o mapas predefinidos.
    if (y > 80) return "jungle"; // Altura alta = selva
    if (y < 50 && this.isWet(x, z)) return "swamp"; // Altura baja + presencia de agua = pantano
    if (this.isDry(x, z)) return "desert"; // Regiones secas = desierto
    return "forest"; // Bioma predeterminado
};

// Métodos auxiliares para biomas:
World.prototype.isWet = function (x, z) {
    // Ficticio: detecta si hay agua cerca
    return this.getBlock(x, 0, z).id === WATER_BLOCK_ID;
};

World.prototype.isDry = function (x, z) {
    // Ficticio: detecta si el área es seca
    return Math.random() > 0.8; // Simula áreas secas (ajusta según tu lógica)
};
