Renderer.prototype.loadShaders = function() {
    if (this.program) return; // Skip if the shaders have already been loaded
    
    var gl = this.gl;
    var program = this.program = gl.createProgram();

    // Compile and attach shaders
    this.compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw "Could not link the shader program!";
    }
    
    gl.useProgram(program);
    this.setupUniformsAndAttributes();
}

Renderer.prototype.compileShader = function(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw "Shader compile error: " + gl.getShaderInfoLog(shader);
    }
    gl.attachShader(this.program, shader);
}

Renderer.prototype.setupUniformsAndAttributes = function() {
    var gl = this.gl;
    var program = this.program;
    
    this.uProjMat = gl.getUniformLocation(program, "uProjMatrix");
    this.uViewMat = gl.getUniformLocation(program, "uViewMatrix");
    this.uModelMat = gl.getUniformLocation(program, "uModelMatrix");
    this.uSampler = gl.getUniformLocation(program, "uSampler");
    this.aPos = gl.getAttribLocation(program, "aPos");
    this.aColor = gl.getAttribLocation(program, "aColor");
    this.aTexCoord = gl.getAttribLocation(program, "aTexCoord");

    // Enable input
    gl.enableVertexAttribArray(this.aPos);
    gl.enableVertexAttribArray(this.aColor);
    gl.enableVertexAttribArray(this.aTexCoord);
}

// Update on block changes
Renderer.prototype.onBlockChanged = function(x, y, z) {
    var chunks = this.chunks;
    var affectedChunks = [];
    
    for (var i = 0; i < chunks.length; i++) {
        var chunk = chunks[i];
        
        // Check if the block is within the chunk bounds or its neighbors
        if (this.isBlockInChunk(x, y, z, chunk)) {
            affectedChunks.push(chunk);
            chunk.dirty = true;
        }
    }

    // Now update the affected chunks only
    for (var i = 0; i < affectedChunks.length; i++) {
        this.updateChunk(affectedChunks[i]);
    }
}

// Check if block is inside a chunk
Renderer.prototype.isBlockInChunk = function(x, y, z, chunk) {
    return x >= chunk.start[0] && x < chunk.end[0] &&
           y >= chunk.start[1] && y < chunk.end[1] &&
           z >= chunk.start[2] && z < chunk.end[2];
}

// Build chunks and update buffers
Renderer.prototype.buildChunks = function(count, playerPos) {
    var gl = this.gl;
    var chunks = this.chunks;
    var world = this.world;

    // Determina el rango de carga alrededor del jugador
    const loadDistance = 32; // Distancia de carga en bloques
    const startX = Math.max(0, Math.floor(playerPos.x) - loadDistance);
    const endX = Math.min(world.sx - 1, Math.floor(playerPos.x) + loadDistance);
    const startY = Math.max(0, Math.floor(playerPos.y) - loadDistance);
    const endY = Math.min(world.sy - 1, Math.floor(playerPos.y) + loadDistance);
    const startZ = Math.max(0, Math.floor(playerPos.z) - loadDistance);
    const endZ = Math.min(world.sz - 1, Math.floor(playerPos.z) + loadDistance);

    for (var i = 0; i < chunks.length; i++) {
        var chunk = chunks[i];

        // Verifica si el chunk está dentro del rango de carga
        if (chunk.start[0] >= startX && chunk.end[0] <= endX &&
            chunk.start[1] >= startY && chunk.end[1] <= endY &&
            chunk.start[2] >= startZ && chunk.end[2] <= endZ) {
            
            if (chunk.dirty) {
                var vertices = [];
                var lightmap = this.createLightmap(chunk);
                
                // Agrega los vértices para los bloques en el chunk
                for (var x = chunk.start[0]; x < chunk.end[0]; x++) {
                    for (var y = chunk.start[1]; y < chunk.end[1]; y++) {
                        for (var z = chunk.start[2]; z < chunk.end[2]; z++) {
                            if (world.blocks[x][y][z] != BLOCK.AIR) {
                                BLOCK.pushVertices(vertices, world, lightmap, x, y, z);
                            }
                        }
                    }
                }

                if (chunk.buffer) {
                    // Actualiza los datos del buffer en lugar de recrearlo
                    gl.bindBuffer(gl.ARRAY_BUFFER, chunk.buffer);
                    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(vertices));
                } else {
                    chunk.buffer = gl.createBuffer();
                    chunk.buffer.vertices = vertices.length / 9;
                    gl.bindBuffer(gl.ARRAY_BUFFER, chunk.buffer);
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
                }
                
                chunk.dirty = false;
                count--;
            }
        }

        if (count == 0) break;
    }
}

// Set perspective matrix
Renderer.prototype.setPerspective = function(fov, min, max) {
    if (this.fov === fov && this.min === min && this.max === max) return; // Skip redundant calculations

    var gl = this.gl;
    this.fov = fov;
    this.min = min;
    this.max = max;

    mat4.perspective(fov, gl.viewportWidth / gl.viewportHeight, min, max, this.projMatrix);
    gl.uniformMatrix4fv(this.uProjMat, false, this.projMatrix);
}

// Set camera position and angle
Renderer.prototype.setCamera = function(pos, ang) {
    if (this.camPos[0] === pos[0] && this.camPos[1] === pos[1] && this.camPos[2] === pos[2] &&
        this.camAng[0] === ang[0] && this.camAng[1] === ang[1] && this.camAng[2] === ang[2]) return; // Skip redundant updates

    var gl = this.gl;
    this.camPos = pos;
    this.camAng = ang;

    mat4.identity(this.viewMatrix);
    mat4.rotate(this.viewMatrix, -ang[0] - Math.PI / 2, [1, 0, 0], this.viewMatrix);
    mat4.rotate(this.viewMatrix, ang[1], [0, 0, 1], this.viewMatrix);
    mat4.rotate(this.viewMatrix, -ang[2], [0, 1, 0], this.viewMatrix);
    mat4.translate(this.viewMatrix, [-pos[0], -pos[1], -pos[2]], this.viewMatrix);
    
    gl.uniformMatrix4fv(this.uViewMat, false, this.viewMatrix);
}
Renderer.prototype.loadPlayerHeadModel = function()
{
	var gl = this.gl;
	
	// Player head
	var vertices = [
		// Top
		-0.25, -0.25, 0.25, 8/64, 0, 1, 1, 1, 1,
		0.25, -0.25, 0.25, 16/64, 0, 1, 1, 1, 1,
		0.25, 0.25, 0.25, 16/64, 8/32, 1, 1, 1, 1,
		0.25, 0.25, 0.25, 16/64, 8/32, 1, 1, 1, 1,
		-0.25, 0.25, 0.25, 8/64, 8/32, 1, 1, 1, 1,
		-0.25, -0.25, 0.25, 8/64, 0, 1, 1, 1, 1,
		
		// Bottom
		-0.25, -0.25, -0.25, 16/64, 0, 1, 1, 1, 1,
		-0.25, 0.25, -0.25, 16/64, 8/32, 1, 1, 1, 1,
		0.25, 0.25, -0.25, 24/64, 8/32, 1, 1, 1, 1,
		0.25, 0.25, -0.25, 24/64, 8/32, 1, 1, 1, 1,
		0.25, -0.25, -0.25, 24/64, 0, 1, 1, 1, 1,
		-0.25, -0.25, -0.25, 16/64, 0, 1, 1, 1, 1,
		
		// Front		
		-0.25, -0.25, 0.25, 8/64, 8/32, 1, 1, 1, 1,
		-0.25, -0.25, -0.25, 8/64, 16/32, 1, 1, 1, 1,
		0.25, -0.25, -0.25, 16/64, 16/32, 1, 1, 1, 1,
		0.25, -0.25, -0.25, 16/64, 16/32, 1, 1, 1, 1,
		0.25, -0.25, 0.25, 16/64, 8/32, 1, 1, 1, 1,
		-0.25, -0.25, 0.25, 8/64, 8/32, 1, 1, 1, 1,
		
		// Rear		
		-0.25, 0.25, 0.25, 24/64, 8/32, 1, 1, 1, 1,
		0.25, 0.25, 0.25, 32/64, 8/32, 1, 1, 1, 1,
		0.25, 0.25, -0.25, 32/64, 16/32, 1, 1, 1, 1,
		0.25, 0.25, -0.25, 32/64, 16/32, 1, 1, 1, 1,
		-0.25, 0.25, -0.25, 24/64, 16/32, 1, 1, 1, 1,
		-0.25, 0.25, 0.25, 24/64, 8/32, 1, 1, 1, 1,
		
		// Right
		-0.25, -0.25, 0.25, 16/64, 8/32, 1, 1, 1, 1,
		-0.25, 0.25, 0.25, 24/64, 8/32, 1, 1, 1, 1,
		-0.25, 0.25, -0.25, 24/64, 16/32, 1, 1, 1, 1,
		-0.25, 0.25, -0.25, 24/64, 16/32, 1, 1, 1, 1,
		-0.25, -0.25, -0.25, 16/64, 16/32, 1, 1, 1, 1,
		-0.25, -0.25, 0.25, 16/64, 8/32, 1, 1, 1, 1,
		
		// Left
		0.25, -0.25, 0.25, 0, 8/32, 1, 1, 1, 1,
		0.25, -0.25, -0.25, 0, 16/32, 1, 1, 1, 1,
		0.25, 0.25, -0.25, 8/64, 16/32, 1, 1, 1, 1,
		0.25, 0.25, -0.25, 8/64, 16/32, 1, 1, 1, 1,
		0.25, 0.25, 0.25, 8/64, 8/32, 1, 1, 1, 1,
		0.25, -0.25, 0.25, 0, 8/32, 1, 1, 1, 1
	];
	
	var buffer = this.playerHead = gl.createBuffer();
	buffer.vertices = vertices.length / 9;
	gl.bindBuffer( gl.ARRAY_BUFFER, buffer );
	gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertices ), gl.DYNAMIC_DRAW );
}


// Loads the player body model into a vertex buffer for rendering.

Renderer.prototype.loadPlayerBodyModel = function()
{
	var gl = this.gl;
	
	var vertices = [
		// Player torso
		
		// Top
		-0.30, -0.125, 1.45, 20/64, 16/32, 1, 1, 1, 1,
		0.30, -0.125, 1.45, 28/64, 16/32, 1, 1, 1, 1,
		0.30, 0.125, 1.45, 28/64, 20/32, 1, 1, 1, 1,
		0.30, 0.125, 1.45, 28/64, 20/32, 1, 1, 1, 1,
		-0.30, 0.125, 1.45, 20/64, 20/32, 1, 1, 1, 1,
		-0.30, -0.125, 1.45, 20/64, 16/32, 1, 1, 1, 1,
		
		// Bottom
		-0.30, -0.125, 0.73, 28/64, 16/32, 1, 1, 1, 1,
		-0.30, 0.125, 0.73, 28/64, 20/32, 1, 1, 1, 1,
		0.30, 0.125, 0.73, 36/64, 20/32, 1, 1, 1, 1,
		0.30, 0.125, 0.73, 36/64, 20/32, 1, 1, 1, 1,
		0.30, -0.125, 0.73, 36/64, 16/32, 1, 1, 1, 1,
		-0.30, -0.125, 0.73, 28/64, 16/32, 1, 1, 1, 1,
		
		// Front		
		-0.30, -0.125, 1.45, 20/64, 20/32, 1, 1, 1, 1,
		-0.30, -0.125, 0.73, 20/64, 32/32, 1, 1, 1, 1,
		0.30, -0.125, 0.73, 28/64, 32/32, 1, 1, 1, 1,
		0.30, -0.125, 0.73, 28/64, 32/32, 1, 1, 1, 1,
		0.30, -0.125, 1.45, 28/64, 20/32, 1, 1, 1, 1,
		-0.30, -0.125, 1.45, 20/64, 20/32, 1, 1, 1, 1,
		
		// Rear		
		-0.30, 0.125, 1.45, 40/64, 20/32, 1, 1, 1, 1,
		0.30, 0.125, 1.45, 32/64, 20/32, 1, 1, 1, 1,
		0.30, 0.125, 0.73, 32/64, 32/32, 1, 1, 1, 1,
		0.30, 0.125, 0.73, 32/64, 32/32, 1, 1, 1, 1,
		-0.30, 0.125, 0.73, 40/64, 32/32, 1, 1, 1, 1,
		-0.30, 0.125, 1.45, 40/64, 20/32, 1, 1, 1, 1,
		
		// Right
		-0.30, -0.125, 1.45, 16/64, 20/32, 1, 1, 1, 1,
		-0.30, 0.125, 1.45, 20/64, 20/32, 1, 1, 1, 1,
		-0.30, 0.125, 0.73, 20/64, 32/32, 1, 1, 1, 1,
		-0.30, 0.125, 0.73, 20/64, 32/32, 1, 1, 1, 1,
		-0.30, -0.125, 0.73, 16/64, 32/32, 1, 1, 1, 1,
		-0.30, -0.125, 1.45, 16/64, 20/32, 1, 1, 1, 1,
		
		// Left
		0.30, -0.125, 1.45, 28/64, 20/32, 1, 1, 1, 1,
		0.30, -0.125, 0.73, 28/64, 32/32, 1, 1, 1, 1,
		0.30, 0.125, 0.73, 32/64, 32/32, 1, 1, 1, 1,
		0.30, 0.125, 0.73, 32/64, 32/32, 1, 1, 1, 1,
		0.30, 0.125, 1.45, 32/64, 20/32, 1, 1, 1, 1,
		0.30, -0.125, 1.45, 28/64, 20/32, 1, 1, 1, 1,
		
	];
	
	var buffer = this.playerBody = gl.createBuffer();
	buffer.vertices = vertices.length / 9;
	gl.bindBuffer( gl.ARRAY_BUFFER, buffer );
	gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertices ), gl.DYNAMIC_DRAW );

	var vertices = [
		// Left arm
		
		// Top
		0.30, -0.125, 0.05, 44/64, 16/32, 1, 1, 1, 1,
		0.55, -0.125, 0.05, 48/64, 16/32, 1, 1, 1, 1,
		0.55,  0.125, 0.05, 48/64, 20/32, 1, 1, 1, 1,
		0.55,  0.125, 0.05, 48/64, 20/32, 1, 1, 1, 1,
		0.30,  0.125, 0.05, 44/64, 20/32, 1, 1, 1, 1,
		0.30, -0.125, 0.05, 44/64, 16/32, 1, 1, 1, 1,
		
		// Bottom
		0.30, -0.125, -0.67, 48/64, 16/32, 1, 1, 1, 1,
		0.30,  0.125, -0.67, 48/64, 20/32, 1, 1, 1, 1,
		0.55,  0.125, -0.67, 52/64, 20/32, 1, 1, 1, 1,
		0.55,  0.125, -0.67, 52/64, 20/32, 1, 1, 1, 1,
		0.55, -0.125, -0.67, 52/64, 16/32, 1, 1, 1, 1,
		0.30, -0.125, -0.67, 48/64, 16/32, 1, 1, 1, 1,
		
		// Front		
		0.30, -0.125,  0.05, 48/64, 20/32, 1, 1, 1, 1,
		0.30, -0.125, -0.67, 48/64, 32/32, 1, 1, 1, 1,
		0.55, -0.125, -0.67, 44/64, 32/32, 1, 1, 1, 1,
		0.55, -0.125, -0.67, 44/64, 32/32, 1, 1, 1, 1,
		0.55, -0.125,  0.05, 44/64, 20/32, 1, 1, 1, 1,
		0.30, -0.125,  0.05, 48/64, 20/32, 1, 1, 1, 1,
		
		// Rear		
		0.30, 0.125,  0.05, 52/64, 20/32, 1, 1, 1, 1,
		0.55, 0.125,  0.05, 56/64, 20/32, 1, 1, 1, 1,
		0.55, 0.125, -0.67, 56/64, 32/32, 1, 1, 1, 1,
		0.55, 0.125, -0.67, 56/64, 32/32, 1, 1, 1, 1,
		0.30, 0.125, -0.67, 52/64, 32/32, 1, 1, 1, 1,
		0.30, 0.125,  0.05, 52/64, 20/32, 1, 1, 1, 1,
		
		// Right
		0.30, -0.125,  0.05, 48/64, 20/32, 1, 1, 1, 1,
		0.30,  0.125,  0.05, 52/64, 20/32, 1, 1, 1, 1,
		0.30,  0.125, -0.67, 52/64, 32/32, 1, 1, 1, 1,
		0.30,  0.125, -0.67, 52/64, 32/32, 1, 1, 1, 1,
		0.30, -0.125, -0.67, 48/64, 32/32, 1, 1, 1, 1,
		0.30, -0.125,  0.05, 48/64, 20/32, 1, 1, 1, 1,
		
		// Left
		0.55, -0.125,  0.05, 44/64, 20/32, 1, 1, 1, 1,
		0.55, -0.125, -0.67, 44/64, 32/32, 1, 1, 1, 1,
		0.55,  0.125, -0.67, 40/64, 32/32, 1, 1, 1, 1,
		0.55,  0.125, -0.67, 40/64, 32/32, 1, 1, 1, 1,
		0.55,  0.125,  0.05, 40/64, 20/32, 1, 1, 1, 1,
		0.55, -0.125,  0.05, 44/64, 20/32, 1, 1, 1, 1,
		
	];
	
	var buffer = this.playerLeftArm = gl.createBuffer();
	buffer.vertices = vertices.length / 9;
	gl.bindBuffer( gl.ARRAY_BUFFER, buffer );
	gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertices ), gl.DYNAMIC_DRAW );

	var vertices = [
		// Right arm
		
		// Top
		-0.55, -0.125, 0.05, 44/64, 16/32, 1, 1, 1, 1,
		-0.30, -0.125, 0.05, 48/64, 16/32, 1, 1, 1, 1,
		-0.30,  0.125, 0.05, 48/64, 20/32, 1, 1, 1, 1,
		-0.30,  0.125, 0.05, 48/64, 20/32, 1, 1, 1, 1,
		-0.55,  0.125, 0.05, 44/64, 20/32, 1, 1, 1, 1,
		-0.55, -0.125, 0.05, 44/64, 16/32, 1, 1, 1, 1,
		
		// Bottom
		-0.55, -0.125, -0.67, 52/64, 16/32, 1, 1, 1, 1,
		-0.55,  0.125, -0.67, 52/64, 20/32, 1, 1, 1, 1,
		-0.30,  0.125, -0.67, 48/64, 20/32, 1, 1, 1, 1,
		-0.30,  0.125, -0.67, 48/64, 20/32, 1, 1, 1, 1,
		-0.30, -0.125, -0.67, 48/64, 16/32, 1, 1, 1, 1,
		-0.55, -0.125, -0.67, 52/64, 16/32, 1, 1, 1, 1,
		
		// Front		
		-0.55, -0.125,  0.05, 44/64, 20/32, 1, 1, 1, 1,
		-0.55, -0.125, -0.67, 44/64, 32/32, 1, 1, 1, 1,
		-0.30, -0.125, -0.67, 48/64, 32/32, 1, 1, 1, 1,
		-0.30, -0.125, -0.67, 48/64, 32/32, 1, 1, 1, 1,
		-0.30, -0.125,  0.05, 48/64, 20/32, 1, 1, 1, 1,
		-0.55, -0.125,  0.05, 44/64, 20/32, 1, 1, 1, 1,
		
		// Rear		
		-0.55, 0.125,  0.05, 56/64, 20/32, 1, 1, 1, 1,
		-0.30, 0.125,  0.05, 52/64, 20/32, 1, 1, 1, 1,
		-0.30, 0.125, -0.67, 52/64, 32/32, 1, 1, 1, 1,
		-0.30, 0.125, -0.67, 52/64, 32/32, 1, 1, 1, 1,
		-0.55, 0.125, -0.67, 56/64, 32/32, 1, 1, 1, 1,
		-0.55, 0.125,  0.05, 56/64, 20/32, 1, 1, 1, 1,
		
		// Right
		-0.55, -0.125,  0.05, 44/64, 20/32, 1, 1, 1, 1,
		-0.55,  0.125,  0.05, 40/64, 20/32, 1, 1, 1, 1,
		-0.55,  0.125, -0.67, 40/64, 32/32, 1, 1, 1, 1,
		-0.55,  0.125, -0.67, 40/64, 32/32, 1, 1, 1, 1,
		-0.55, -0.125, -0.67, 44/64, 32/32, 1, 1, 1, 1,
		-0.55, -0.125,  0.05, 44/64, 20/32, 1, 1, 1, 1,
		
		// Left
		-0.30, -0.125,  0.05, 48/64, 20/32, 1, 1, 1, 1,
		-0.30, -0.125, -0.67, 48/64, 32/32, 1, 1, 1, 1,
		-0.30,  0.125, -0.67, 52/64, 32/32, 1, 1, 1, 1,
		-0.30,  0.125, -0.67, 52/64, 32/32, 1, 1, 1, 1,
		-0.30,  0.125,  0.05, 52/64, 20/32, 1, 1, 1, 1,
		-0.30, -0.125,  0.05, 48/64, 20/32, 1, 1, 1, 1,
		
	];
	
	var buffer = this.playerRightArm = gl.createBuffer();
	buffer.vertices = vertices.length / 9;
	gl.bindBuffer( gl.ARRAY_BUFFER, buffer );
	gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertices ), gl.DYNAMIC_DRAW );

	var vertices = [
		// Left leg
		
		// Top
		0.01, -0.125, 0, 4/64, 16/32, 1, 1, 1, 1,
		0.3,  -0.125, 0, 8/64, 16/32, 1, 1, 1, 1,
		0.3,   0.125, 0, 8/64, 20/32, 1, 1, 1, 1,
		0.3,   0.125, 0, 8/64, 20/32, 1, 1, 1, 1,
		0.01,  0.125, 0, 4/64, 20/32, 1, 1, 1, 1,
		0.01, -0.125, 0, 4/64, 16/32, 1, 1, 1, 1,
		
		// Bottom
		0.01, -0.125, -0.73,  8/64, 16/32, 1, 1, 1, 1,
		0.01,  0.125, -0.73,  8/64, 20/32, 1, 1, 1, 1,
		0.3,   0.125, -0.73, 12/64, 20/32, 1, 1, 1, 1,
		0.3,   0.125, -0.73, 12/64, 20/32, 1, 1, 1, 1,
		0.3,  -0.125, -0.73, 12/64, 16/32, 1, 1, 1, 1,
		0.01, -0.125, -0.73,  8/64, 16/32, 1, 1, 1, 1,
		
		// Front		
		0.01, -0.125,     0, 4/64, 20/32, 1, 1, 1, 1,
		0.01, -0.125, -0.73, 4/64, 32/32, 1, 1, 1, 1,
		0.3,  -0.125, -0.73, 8/64, 32/32, 1, 1, 1, 1,
		0.3,  -0.125, -0.73, 8/64, 32/32, 1, 1, 1, 1,
		0.3,  -0.125,     0, 8/64, 20/32, 1, 1, 1, 1,
		0.01, -0.125,     0, 4/64, 20/32, 1, 1, 1, 1,
		
		// Rear		
		0.01, 0.125,     0, 12/64, 20/32, 1, 1, 1, 1,
		0.3,  0.125,     0, 16/64, 20/32, 1, 1, 1, 1,
		0.3,  0.125, -0.73, 16/64, 32/32, 1, 1, 1, 1,
		0.3,  0.125, -0.73, 16/64, 32/32, 1, 1, 1, 1,
		0.01, 0.125, -0.73, 12/64, 32/32, 1, 1, 1, 1,
		0.01, 0.125,     0, 12/64, 20/32, 1, 1, 1, 1,
		
		// Right
		0.01, -0.125,     0,  8/64, 20/32, 1, 1, 1, 1,
		0.01,  0.125,     0, 12/64, 20/32, 1, 1, 1, 1,
		0.01,  0.125, -0.73, 12/64, 32/32, 1, 1, 1, 1,
		0.01,  0.125, -0.73, 12/64, 32/32, 1, 1, 1, 1,
		0.01, -0.125, -0.73,  8/64, 32/32, 1, 1, 1, 1,
		0.01, -0.125,     0,  8/64, 20/32, 1, 1, 1, 1,
		
		// Left
		0.3, -0.125,     0, 4/64, 20/32, 1, 1, 1, 1,
		0.3, -0.125, -0.73, 4/64, 32/32, 1, 1, 1, 1,
		0.3,  0.125, -0.73, 0/64, 32/32, 1, 1, 1, 1,
		0.3,  0.125, -0.73, 0/64, 32/32, 1, 1, 1, 1,
		0.3,  0.125,     0, 0/64, 20/32, 1, 1, 1, 1,
		0.3, -0.125,     0, 4/64, 20/32, 1, 1, 1, 1,
	];
	
	var buffer = this.playerLeftLeg = gl.createBuffer();
	buffer.vertices = vertices.length / 9;
	gl.bindBuffer( gl.ARRAY_BUFFER, buffer );
	gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertices ), gl.DYNAMIC_DRAW );

	var vertices = [
		// Right leg
		
		// Top
		-0.3,  -0.125, 0, 4/64, 16/32, 1, 1, 1, 1,
		-0.01, -0.125, 0, 8/64, 16/32, 1, 1, 1, 1,
		-0.01,  0.125, 0, 8/64, 20/32, 1, 1, 1, 1,
		-0.01,  0.125, 0, 8/64, 20/32, 1, 1, 1, 1,
		-0.3,   0.125, 0, 4/64, 20/32, 1, 1, 1, 1,
		-0.3,  -0.125, 0, 4/64, 16/32, 1, 1, 1, 1,
		
		// Bottom
		-0.3,  -0.125, -0.73,  8/64, 16/32, 1, 1, 1, 1,
		-0.3,   0.125, -0.73,  8/64, 20/32, 1, 1, 1, 1,
		-0.01,  0.125, -0.73, 12/64, 20/32, 1, 1, 1, 1,
		-0.01,  0.125, -0.73, 12/64, 20/32, 1, 1, 1, 1,
		-0.01, -0.125, -0.73, 12/64, 16/32, 1, 1, 1, 1,
		-0.3,  -0.125, -0.73,  8/64, 16/32, 1, 1, 1, 1,
		
		// Front		
		-0.3,  -0.125,     0, 4/64, 20/32, 1, 1, 1, 1,
		-0.3,  -0.125, -0.73, 4/64, 32/32, 1, 1, 1, 1,
		-0.01, -0.125, -0.73, 8/64, 32/32, 1, 1, 1, 1,
		-0.01, -0.125, -0.73, 8/64, 32/32, 1, 1, 1, 1,
		-0.01, -0.125,     0, 8/64, 20/32, 1, 1, 1, 1,
		-0.3,  -0.125,     0, 4/64, 20/32, 1, 1, 1, 1,
		
		// Rear		
		-0.3,  0.125,     0, 16/64, 20/32, 1, 1, 1, 1,
		-0.01, 0.125,     0, 12/64, 20/32, 1, 1, 1, 1,
		-0.01, 0.125, -0.73, 12/64, 32/32, 1, 1, 1, 1,
		-0.01, 0.125, -0.73, 12/64, 32/32, 1, 1, 1, 1,
		-0.3,  0.125, -0.73, 16/64, 32/32, 1, 1, 1, 1,
		-0.3,  0.125,     0, 16/64, 20/32, 1, 1, 1, 1,
		
		// Right
		-0.3, -0.125,     0, 4/64, 20/32, 1, 1, 1, 1,
		-0.3,  0.125,     0, 0/64, 20/32, 1, 1, 1, 1,
		-0.3,  0.125, -0.73, 0/64, 32/32, 1, 1, 1, 1,
		-0.3,  0.125, -0.73, 0/64, 32/32, 1, 1, 1, 1,
		-0.3, -0.125, -0.73, 4/64, 32/32, 1, 1, 1, 1,
		-0.3, -0.125,     0, 4/64, 20/32, 1, 1, 1, 1,
		
		// Left
		-0.01, -0.125,    0,   8/64, 20/32, 1, 1, 1, 1,
		-0.01, -0.125, -0.73,  8/64, 32/32, 1, 1, 1, 1,
		-0.01,  0.125, -0.73, 12/64, 32/32, 1, 1, 1, 1,
		-0.01,  0.125, -0.73, 12/64, 32/32, 1, 1, 1, 1,
		-0.01,  0.125,     0, 12/64, 20/32, 1, 1, 1, 1,
		-0.01, -0.125,     0,  8/64, 20/32, 1, 1, 1, 1
	];
}
// Render player model
Renderer.prototype.renderPlayer = function(playerModel, playerPos, playerRotation) {
    var gl = this.gl;

    // Set the player model's transformation matrix
    mat4.identity(this.modelMatrix);
    mat4.translate(this.modelMatrix, playerPos, this.modelMatrix);
    mat4.rotate(this.modelMatrix, playerRotation[0], [1, 0, 0], this.modelMatrix);
    mat4.rotate(this.modelMatrix, playerRotation[1], [0, 1, 0], this.modelMatrix);

    gl.uniformMatrix4fv(this.uModelMat, false, this.modelMatrix);

    // Bind the player model's buffer and draw
    gl.bindBuffer(gl.ARRAY_BUFFER, playerModel.buffer);
    gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, playerModel.vertexCount);
}
