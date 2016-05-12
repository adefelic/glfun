// functions.js
//
// hic sunt memory leaks, ignoring for now
//
// inspiration, theft from:
//   https://dev.opera.com/articles/raw-webgl-part-2-simple-shader/webgl-utils.js
//   https://developer.mozilla.org/en-US/docs/Web/WebGL
//   https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial
//   http://learningwebgl.com/
//

// application variables
var gl;               // webGL drawing context
var mvMatrix;         // model-view matrix
var mvMatrixStack;    // so we can push and pop
var pMatrix;          // projection matrix
var shaderProgram;    // shader program
var lastTime = 0;     // last time the animation updated

var Camera = function () {
	// i am the constructor
};

/**
 * Node constructor
 * represents a node on the scene graph
 */
var Node = function( nodeData ) {

	// declare our instance attributes
	this.vertexPositionBuffer = null;
	this.vertexIndexBuffer = null;
	this.vertexColorBuffer = null;
	this.vertexNormalBuffer = null;
	this.rotX = null;
	this.scale = null;

	//
	// vertex positions
	//
	this.vertexPositionBuffer = gl.createBuffer();
	// put vertexPositionBuffer in the array buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPositionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeData.vertices), gl.STATIC_DRAW);
	this.vertexPositionBuffer.itemSize = 3; // 3 values per vertex, x y z
	this.vertexPositionBuffer.numItems = nodeData.vertices.length / this.vertexPositionBuffer.itemSize;

	//
	// index vertices
	//
	this.vertexIndexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(nodeData.vertexIndex), gl.STATIC_DRAW);
	this.vertexIndexBuffer.itemSize = 1; // 1 index per vertex
	this.vertexIndexBuffer.numItems = nodeData.vertexIndex.length / this.vertexIndexBuffer.itemSize;

	/*
		//
		// vertex colors
		//
		this.vertexColorBuffer = gl.createBuffer();
		// put vertexColorBuffer in the array buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColorBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeData.vertexColors), gl.STATIC_DRAW);
		this.vertexColorBuffer.itemSize = 4; // 4 values per vertex , r g b a
		this.vertexColorBuffer.numItems = nodeData.vertexColors.length / this.vertexColorBuffer.itemSize;
	*/

	/*
		//
		// vertex normals
		//
		this.vertexNormalBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexNormalBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeData.vertexNormals), gl.STATIC_DRAW);
		this.vertexNormalBuffer.itemSize = 4; // 3 values per vertex , x y z
		this.vertexNormalBuffer.numItems = nodeData.vertexNormals.length / this.vertexNormalBuffer.itemSize;
	*/

	//
	// textures
	//

	// make a 1px texture that'll load real fast, then pop in the new one later
	this.texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, this.texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
		new Uint8Array([255, 0, 0, 255])); // red

	// here comes the "real" texture creation + handling
	this.textureImage = new Image();
	this.textureImage.src = nodeData.texturePath;
	//this.textureImage.crossOrigin = 'anonymous'; // hack
	var self = this;
	this.textureImage.onload = function() {
		this.texture = gl.createTexture();
		console.log('texture loaded');
		gl.bindTexture(gl.TEXTURE_2D, self.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, self.textureImage);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.bindTexture(gl.TEXTURE_2D, null); // cleanup
	};

	this.vertexTextureCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexTextureCoordBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeData.textureCoords), gl.STATIC_DRAW);
	this.vertexTextureCoordBuffer.itemSize = 2;
	this.vertexTextureCoordBuffer.numItems = nodeData.textureCoords.length / this.vertexTextureCoordBuffer.itemSize;

	//
	// transform things
	//
	this.rotX = 0.0;
	this.scale = 1;
};

function initGL(canvas) {
	gl = null;
	try {
		gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
		gl.viewportWidth  = canvas.width;
		gl.viewportHeight = canvas.height;
	}
	catch(e) {
		console.error("Couldn't init WebGL, please use a newer browser");
		gl = null;
	}
}

// stole this from learningwebgl.com/lessons/lesson01/index.html
function getShader(id) {
	var shaderScript = document.getElementById(id);
	if (!shaderScript) {
		return null;
	}

	var str = "";
	var k = shaderScript.firstChild;
	while (k) {
		if (k.nodeType == 3) {
			str += k.textContent;
		}
		k = k.nextSibling;
	}

	var shader;
	if (shaderScript.type == "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if (shaderScript.type == "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		return null;
	}

	gl.shaderSource(shader, str);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}

// shader code needs to be refactored
function initShaders() {

	// init model-view and projection matrices
	mvMatrix = mat4.create();
	pMatrix  = mat4.create();
	mvMatrixStack = [];

	// create the shader program
	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, getShader("shader-fs"));
	gl.attachShader(shaderProgram, getShader("shader-vs"));
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		throw gl.getProgramInfoLog(shaderProgram);
	}

	// use shader program
	gl.useProgram(shaderProgram);

	//
	// store some shader hooks
	//

	// vertex positions !
	shaderProgram.vertexPosAttrib = gl.getAttribLocation(shaderProgram, 'aVertexPos');
	gl.enableVertexAttribArray(shaderProgram.vertexPosAttrib);

	/*
		// vertex normals !
		shaderProgram.vertexNormalAttrib = gl.getAttribLocation(shaderProgram, 'aVertexNormal');
		gl.enableVertexAttribArray(shaderProgram.vertexNormalAttrib);
	*/

	/*
		// vertex colors !
		shaderProgram.vertexColorAttrib = gl.getAttribLocation(shaderProgram, 'aVertexColor');
		gl.enableVertexAttribArray(shaderProgram.vertexColorAttrib);
	*/

	// texture mapping
	shaderProgram.textureCoordAttrib = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
	gl.enableVertexAttribArray(shaderProgram.textureCoordAttrib);

	// set perspective and modelview matrices
	shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, 'uPMatrix');
	shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, 'uMVMatrix');
}

function mvPushMatrix() {
	var copy = mat4.create();
	mat4.set(mvMatrix, copy);
	mvMatrixStack.push(copy);
}

function mvPopMatrix() {
	if (mvMatrixStack.length === 0) {
		throw "Invalid popMatrix!";
	}
	mvMatrix = mvMatrixStack.pop();
}

// pushes changes to projection and model-view matrices to the gpu
function setMatrixUniforms() {
	gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
	gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

function drawScene() {
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
	mat4.perspective(45, gl.viewportWidth/gl.viewportHeight, 0.1, 100.0, pMatrix);

	mat4.identity(mvMatrix);
	mat4.translate(mvMatrix, [0.0, 0.0, -8.0]);

	for (var i = nodes.length - 1; i >= 0; i--) {
		mvPushMatrix();

			// let's roll
			mat4.rotate(mvMatrix, nodes[i].rotX, [1, 1, 0]);

			// bounce
			mat4.scale(mvMatrix, [nodes[i].scale, nodes[i].scale, nodes[i].scale]);

			// position those vertices
			gl.bindBuffer(gl.ARRAY_BUFFER, nodes[i].vertexPositionBuffer);
			gl.vertexAttribPointer(
				shaderProgram.vertexPosAttrib,
				nodes[i].vertexPositionBuffer.itemSize,
				gl.FLOAT,
				false,
				0,
				0
			);

			/*
				// normals!
				gl.bindBuffer(gl.ARRAY_BUFFER, nodes[i].vertexNormalBuffer);
				gl.vertexAttribPointer(
					shaderProgram.vertexNormalAttrib,
					nodes[i].vertexNormalBuffer.itemSize,
					gl.FLOAT,
					false,
					0,
					0
				);
			*/

			/*
				// shade 'em too
				gl.bindBuffer(gl.ARRAY_BUFFER, nodes[i].vertexColorBuffer);
				gl.vertexAttribPointer(
					shaderProgram.vertexColorAttrib,
					nodes[i].vertexColorBuffer.itemSize,
					gl.FLOAT,
					false,
					0,
					0
				);
			*/

				// textures!!
				gl.bindBuffer(gl.ARRAY_BUFFER, nodes[i].vertexTextureCoordBuffer);
				gl.vertexAttribPointer(
					shaderProgram.textureCoordAttrib,
					nodes[i].vertexTextureCoordBuffer.itemSize,
					gl.FLOAT,
					false,
					0,
					0
				);

			// texture
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, nodes[i].texture);
			gl.uniform1i(gl.getUniformLocation(shaderProgram, 'uSampler'), 0);

			// element array
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, nodes[i].vertexIndexBuffer);
			// push to gpu
			setMatrixUniforms();
			// draw
			gl.drawElements(gl.TRIANGLES, nodes[i].vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
		mvPopMatrix();
	}
}

// latency cleverness from http://learningwebgl.com/blog/?p=239
function animate() {
	var timeNow = new Date().getTime();

	if (lastTime !== 0) {
		for (var i = nodes.length - 1; i >= 0; i--) {
			//dumpNode(i);
			var elapsed = timeNow - lastTime;
			nodes[i].rotX += (Math.PI/2 * elapsed / 1000.0); // this will overflow eventually
			nodes[i].rotX %= Math.PI*2;
			nodes[i].scale = (Math.sin(nodes[i].rotX) + 3) / 3;
		}
	}
	lastTime = timeNow;
	return nodes;
}

function dumpNode( i ) {
	console.log('rotX: ' + nodes[i].rotX);
	console.log('scale: ' + nodes[i].scale);
	console.log('\n');
}

function tick() {
	// thanks for the function, google
	// make tick() the callback rendering function for window.requestAnimFrame()
	requestAnimFrame( tick );
	drawScene();
	animate();
}

function startGL() {
	var canvas = document.getElementById("gl1");
	initGL(canvas);
	// nodeData is a bunch of json node representations, just loads of em
	// global nodes
	nodes = [];
	// init a node on the scene graph for each node in json
	// this program assumes that all nodes are created in the next loop
	for (var i = nodeData.length - 1; i >= 0; i--) {
		nodes.push(
			new Node( nodeData[i] )
		);
	}

	initShaders();
	gl.clearColor(0.0, 0.0, 0.0, 1.0); // black
	gl.enable(gl.DEPTH_TEST);
	tick();
}
