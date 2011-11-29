/*!
 * New BSD License
 *
 * Copyright (c) 2011, Morten Nobel-Joergensen, Kickstart Games ( http://www.kickstartgames.com/ )
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
 * following conditions are met:
 *
 * - Redistributions of source code must retain the above copyright notice, this list of conditions and the following
 * disclaimer.
 * - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
 * disclaimer in the documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
 * INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
var KICK = KICK || {};
KICK.namespace = function (ns_string) {
    var parts = ns_string.split("."),
        parent = window,
        i;

    for (i = 0; i < parts.length; i += 1) {
        // create property if it doesn't exist
        if (typeof parent[parts[i]] === "undefined") {
            parent[parts[i]] = {};
        }
        parent = parent[parts[i]];
    }
    return parent;
};

(function () {
    "use strict"; // force strict ECMAScript 5
    var material = KICK.namespace("KICK.material"),
        math = KICK.namespace("KICK.math"),
        mat3 = math.mat3,
        mat4 = math.mat4,
        core = KICK.namespace("KICK.core"),
        applyConfig = core.Util.applyConfig,
        c = KICK.core.Constants;

    /**
     * GLSL Shader object
     * @class Shader
     * @namespace KICK.material
     * @constructor
     * @param {KICK.core.Engine} engine
     * @param {Object} config
     * @extends KICK.core.ProjectAsset
     */
    material.Shader = function (engine, config) {
        //todo add support for polygon offset
        var gl = engine.gl,
            thisObj = this,
            _shaderProgramId = -1,
            _depthMask = true,
            _faceCulling = core.Constants.GL_BACK,
            _zTest = core.Constants.GL_LESS,
            _blend = false,
            _blendSFactor = core.Constants.GL_SRC_ALPHA,
            _blendDFactor = core.Constants.GL_ONE_MINUS_SRC_ALPHA,
            _renderOrder = 1000,
            _dataURI = null,
            _name = "",
            blendKey,
            glslConstants = material.GLSLConstants,
            _vertexShaderSrc = glslConstants["error_vs.glsl"],
            _fragmentShaderSrc = glslConstants["error_fs.glsl"],
            _errorLog = KICK.core.Util.fail,
            /**
             * Updates the blend key that identifies blend+blendSFactor+blendDFactor<br>
             * The key is used to fast determine if the blend settings needs to be updated
             * @method getBlendKey
             */
            updateBlendKey = function(){
                blendKey = (_blendSFactor + _blendDFactor*10000)*(_blend?-1:1);
            },
            /**
             * Invoke shader compilation
             * @method compileShader
             * @param {String} str
             * @param {Boolean} isFragmentShader
             * @private
             */
            compileShader = function (str, isFragmentShader) {
                var shader,
                    c = KICK.core.Constants;
                str = material.Shader.getPrecompiledSource(str);
                if (isFragmentShader) {
                    shader = gl.createShader(c.GL_FRAGMENT_SHADER);
                } else {
                    shader = gl.createShader(c.GL_VERTEX_SHADER);
                }

                gl.shaderSource(shader, str);
                gl.compileShader(shader);

                if (!gl.getShaderParameter(shader, c.GL_COMPILE_STATUS)) {
                    var infoLog =gl.getShaderInfoLog(shader);
                    if (typeof _errorLog === "function") {
                        _errorLog(infoLog);
                    }
                    return null;
                }

                return shader;
            },
            updateCullFace = function () {
                var currentFaceCulling = gl.faceCulling;
                if (currentFaceCulling !== _faceCulling) {
                    if (_faceCulling === core.Constants.GL_NONE) {
                        gl.disable( c.GL_CULL_FACE );
                    } else {
                        if (!currentFaceCulling || currentFaceCulling === core.Constants.GL_NONE) {
                            gl.enable( c.GL_CULL_FACE );
                        }
                        gl.cullFace( _faceCulling );
                    }
                    gl.faceCulling = _faceCulling;
                }
            },
            updateDepthProperties = function () {
                if (gl.zTest !== _zTest) {
                    gl.depthFunc(_zTest);
                    gl.zTest = _zTest;
                }
                if (gl.depthMaskCache !== _depthMask){
                    gl.depthMask(_depthMask);
                    gl.depthMaskCache = _depthMask;
                }
            },
            updateBlending = function () {
                if (gl.blendKey !== blendKey){
                    gl.blendKey = blendKey;
                    if (_blend){
                        gl.enable(KICK.core.Constants.GL_BLEND);
                    } else {
                        gl.disable(KICK.core.Constants.GL_BLEND);
                    }
                    gl.blendFunc(_blendSFactor,_blendDFactor);
                }
            };

        Object.defineProperties(this,{
            /**
             * @property name
             * @type String
             */
            name:{
                get:function(){ return _name; },
                set:function(newValue){ _name = newValue; }
            },
            /**
             * When dataURI is specified the shader is expected to have its content from the dataURI.
             * This means when serializing the object only dataURI and name will be saved
             * @property dataURI
             * @type String
             */
            dataURI:{
                get:function(){ return _dataURI; },
                set:function(newValue){ _dataURI = newValue; }
            },
            /**
             * Get the gl context of the shader
             * @property gl
             * @type Object
             */
            gl:{
                value:gl
            },
            /**
             * @property vertexShaderSrc
             * @type string
             */
            vertexShaderSrc:{
                get:function(){ return _vertexShaderSrc; },
                set:function(value){
                    if (typeof value !== "string"){
                        KICK.core.Util.fail("Shader.vertexShaderSrc must be a string");
                    }
                    _vertexShaderSrc = value;
                }
            },
            /**
             * @property fragmentShaderSrc
             * @type string
             */
            fragmentShaderSrc:{
                get:function(){ return _fragmentShaderSrc; },
                set:function(value){
                    if (typeof value !== "string"){
                        KICK.core.Util.fail("Shader.fragmentShaderSrc must be a string");
                    }
                    _fragmentShaderSrc = value;
                }
            },
            /**
             * Render order. Default value 1000. The following ranges are predefined:<br>
             * 0-999: Background. Mainly for skyboxes etc<br>
             * 1000-1999 Opaque geometry  (default)<br>
             * 2000-2999 Transparent. This queue is sorted in a back to front order before rendering.<br>
             * 3000-3999 Overlay
             * @property renderOrder
             * @type Number
             */
            renderOrder:{
                get:function(){ return _renderOrder; },
                set:function(value){
                    if (typeof value !== "number"){
                        KICK.core.Util.fail("Shader.renderOrder must be a number");
                    }
                    _renderOrder = value;
                }
            },
            /**
             * Function that will be invoked in case of error
             * @property errorLog
             * @type Function
             */
            errorLog:{
                get:function(){
                    return _errorLog;
                },
                set: function(value){
                    if (KICK.core.Constants._ASSERT){
                        if ( value && typeof value !== 'function'){
                            KICK.core.Util.fail("Shader.errorLog should be a function (or null)");
                        }
                    }
                    _errorLog = value;
                }
            },
            /**
             * A reference to the engine object
             * @property engine
             * @type KICK.core.Engine
             */
            engine:{
                value:engine
            },
            /**
             * @property shaderProgramId
             * @type ShaderProgram
             */
            shaderProgramId:{
                get: function(){ return _shaderProgramId;}
            },
            /**
             * Must be set to KICK.core.Constants.GL_FRONT, KICK.core.Constants.GL_BACK (default),
             * KICK.core.Constants.GL_FRONT_AND_BACK, KICK.core.Constants.NONE<br>
             * Note that in faceCulling = GL_FRONT, GL_BACK or GL_FRONT_AND_BACK with face culling enabled<br>
             * faceCulling = GL_NONE means face culling disabled
             * @property faceCulling
             * @type Object
             */
            faceCulling: {
                get: function(){ return _faceCulling; },
                set: function(newValue){
                    if (KICK.core.Constants._ASSERT){
                        if (newValue !== core.Constants.GL_FRONT &&
                            newValue !== core.Constants.GL_FRONT_AND_BACK &&
                            newValue !== core.Constants.GL_BACK &&
                            newValue !== core.Constants.GL_NONE ){
                            KICK.core.Util.fail("Shader.faceCulling must be KICK.material.Shader.FRONT, " +
                                "KICK.material.Shader.BACK (default), KICK.material.Shader.NONE");
                        }
                    }
                    _faceCulling = newValue;
                }
            },
            /**
             * Enable or disable writing into the depth buffer
             * @property depthMask
             * @type Boolean
             */
            depthMask:{
                get:function(){return _depthMask},
                set:function(newValue){
                    if (KICK.core.Constants._ASSERT){
                        if (typeof newValue !== 'boolean'){
                            KICK.core.Util.fail("Shader.depthMask must be a boolean. Was "+(typeof newValue));
                        }
                    }
                    _depthMask = newValue;
                }
            },
            /**
             * The depth test function. Must be one of
             * KICK.core.Constants.GL_NEVER,
             * KICK.core.Constants.GL_LESS,
             * KICK.core.Constants.GL_EQUAL,
             * KICK.core.Constants.GL_LEQUAL,
             * KICK.core.Constants.GL_GREATER,
             * KICK.core.Constants.GL_NOTEQUAL,
             * KICK.core.Constants.GL_GEQUAL,
             * KICK.core.Constants.GL_ALWAYS
             * @property zTest
             * @type Object
             */
            zTest:{
                get: function(){ return _zTest; },
                set: function(newValue){
                    if (KICK.core.Constants._ASSERT){
                        if (newValue !== core.Constants.GL_NEVER &&
                            newValue !== core.Constants.GL_LESS &&
                            newValue !== core.Constants.GL_EQUAL &&
                            newValue !== core.Constants.GL_LEQUAL &&
                            newValue !== core.Constants.GL_GREATER &&
                            newValue !== core.Constants.GL_NOTEQUAL &&
                            newValue !== core.Constants.GL_GEQUAL &&
                            newValue !== core.Constants.GL_ALWAYS){
                            KICK.core.Util.fail("Shader.zTest must be KICK.core.Constants.GL_NEVER, " +
                                "KICK.core.Constants.GL_LESS,KICK.core.Constants.GL_EQUAL,KICK.core.Constants.GL_LEQUAL," +
                                "KICK.core.Constants.GL_GREATER,KICK.core.Constants.GL_NOTEQUAL,KICK.core.Constants.GL_GEQUAL, " +
                                "or KICK.core.Constants.GL_ALWAYS");
                        }
                    }
                    _zTest = newValue;
                }
            },
            /**
             * Enables/disables blending (default is false).<br>
             * "In RGBA mode, pixels can be drawn using a function that blends the incoming (source) RGBA values with the
             * RGBA values that are already in the frame buffer (the destination values)"
             * (From <a href="http://www.opengl.org/sdk/docs/man/xhtml/glBlendFunc.xml">www.Opengl.org</a>)
             * @property blend
             * @type Boolean
             */
            blend:{
                get: function(){ return _blend; },
                set: function(value){
                    if (KICK.core.Constants._ASSERT){
                        if (typeof value !== 'boolean'){
                            KICK.core.Util.fail("Shader.blend must be a boolean");
                        }
                    }
                    _blend = value;
                    updateBlendKey();
                }
            },
            /**
             * Specifies the blend s-factor<br>
             * Initial value GL_SRC_ALPHA
             * Must be set to one of: GL_ZERO, GL_ONE, GL_SRC_COLOR, GL_ONE_MINUS_SRC_COLOR, GL_DST_COLOR,
             * GL_ONE_MINUS_DST_COLOR, GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_DST_ALPHA, GL_ONE_MINUS_DST_ALPHA,
             * GL_CONSTANT_COLOR, GL_ONE_MINUS_CONSTANT_COLOR, GL_CONSTANT_ALPHA, GL_ONE_MINUS_CONSTANT_ALPHA, and
             * GL_SRC_ALPHA_SATURATE.<br>
             * See <a href="http://www.opengl.org/sdk/docs/man/xhtml/glBlendFunc.xml">glBlendFunc on opengl.org</a>
             * @property blendSFactor
             * @type {Number}
             */
            blendSFactor:{
                get: function(){ return _blendSFactor;},
                set: function(value) {
                    if (KICK.core.Constants._ASSERT){
                        var c = KICK.core.Constants;
                        if (value !== c.GL_ZERO &&
                            value !== c.GL_ONE &&
                            value !== c.GL_SRC_COLOR &&
                            value !== c.GL_ONE_MINUS_SRC_COLOR &&
                            value !== c.GL_DST_COLOR &&
                            value !== c.GL_ONE_MINUS_DST_COLOR &&
                            value !== c.GL_SRC_ALPHA &&
                            value !== c.GL_GL_ONE_MINUS_SRC_ALPHA &&
                            value !== c.GL_DST_ALPHA &&
                            value !== c.GL_ONE_MINUS_DST_ALPHA &&
                            value !== c.GL_CONSTANT_COLOR &&
                            value !== c.GL_ONE_MINUS_CONSTANT_COLOR,
                            value !== c.GL_CONSTANT_ALPHA &&
                            value !== c.GL_ONE_MINUS_CONSTANT_ALPHA &&
                            value !== c.GL_SRC_ALPHA_SATURATE){
                            KICK.core.Util.fail("Shader.blendSFactor must be a one of GL_ZERO, GL_ONE, GL_SRC_COLOR, " +
                                "GL_ONE_MINUS_SRC_COLOR, GL_DST_COLOR, GL_ONE_MINUS_DST_COLOR, GL_SRC_ALPHA, " +
                                "GL_ONE_MINUS_SRC_ALPHA, GL_DST_ALPHA, GL_ONE_MINUS_DST_ALPHA, GL_CONSTANT_COLOR, " +
                                "GL_ONE_MINUS_CONSTANT_COLOR, GL_CONSTANT_ALPHA, GL_ONE_MINUS_CONSTANT_ALPHA, and " +
                                "GL_SRC_ALPHA_SATURATE.");
                        }
                    }
                    _blendSFactor = value;
                    updateBlendKey();
                }
            },
            /**
             * Specifies the blend d-factor<br>
             * Initial value GL_SRC_ALPHA
             * Must be set to one of: GL_ZERO, GL_ONE, GL_SRC_COLOR, GL_ONE_MINUS_SRC_COLOR, GL_DST_COLOR,
             * GL_ONE_MINUS_DST_COLOR, GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_DST_ALPHA, GL_ONE_MINUS_DST_ALPHA,
             * GL_CONSTANT_COLOR, GL_ONE_MINUS_CONSTANT_COLOR, GL_CONSTANT_ALPHA, GL_ONE_MINUS_CONSTANT_ALPHA, and
             * GL_ONE_MINUS_SRC_ALPHA.<br>
             * See <a href="http://www.opengl.org/sdk/docs/man/xhtml/glBlendFunc.xml">glBlendFunc on opengl.org</a>
             * @property blendSFactor
             * @type {Number}
             */
            blendDFactor:{
                get: function(){ return _blendDFactor; },
                set: function(value){
                    if (KICK.core.Constants._ASSERT){
                        var c = KICK.core.Constants;
                        if (value !== c.GL_ZERO &&
                            value !== c.GL_ONE &&
                            value !== c.GL_SRC_COLOR &&
                            value !== c.GL_ONE_MINUS_SRC_COLOR &&
                            value !== c.GL_DST_COLOR &&
                            value !== c.GL_ONE_MINUS_DST_COLOR &&
                            value !== c.GL_SRC_ALPHA &&
                            value !== c.GL_GL_ONE_MINUS_SRC_ALPHA &&
                            value !== c.GL_DST_ALPHA &&
                            value !== c.GL_ONE_MINUS_DST_ALPHA &&
                            value !== c.GL_CONSTANT_COLOR &&
                            value !== c.GL_ONE_MINUS_CONSTANT_COLOR,
                            value !== c.GL_CONSTANT_ALPHA &&
                            value !== c.GL_ONE_MINUS_CONSTANT_ALPHA){
                            KICK.core.Util.fail("Shader.blendSFactor must be a one of GL_ZERO, GL_ONE, GL_SRC_COLOR, " +
                                "GL_ONE_MINUS_SRC_COLOR, GL_DST_COLOR, GL_ONE_MINUS_DST_COLOR, GL_SRC_ALPHA, " +
                                "GL_ONE_MINUS_SRC_ALPHA, GL_DST_ALPHA, GL_ONE_MINUS_DST_ALPHA, GL_CONSTANT_COLOR, " +
                                "GL_ONE_MINUS_CONSTANT_COLOR, GL_CONSTANT_ALPHA, and GL_ONE_MINUS_CONSTANT_ALPHA.");
                        }
                    }
                    _blendDFactor = value;
                    updateBlendKey();
                }
            }
        });

        /**
         * Flush the current shader bound - this force the shader to be reloaded (and its uniforms and vertex attributes
         * are reassigned)
         * @method markUniformUpdated
         */
        this.markUniformUpdated = function(){
            gl.boundShader = -1;
            gl.meshShader = -1;
        };

        /**
         * @method updateShader
         * @return {Boolean} shader created successfully
         */
        this.updateShader = function () {
            var errorLog = _errorLog || console.log,
                vertexShader = compileShader(_vertexShaderSrc, false, errorLog),
                fragmentShader = compileShader(_fragmentShaderSrc, true, errorLog),
                compileError = fragmentShader === null || vertexShader === null,
                i,
                c = KICK.core.Constants,
                activeUniforms,
                activeAttributes,
                attribute;
            if (compileError){
                vertexShader = compileShader(glslConstants["error_vs.glsl"], false, errorLog);
                fragmentShader = compileShader(glslConstants["error_fs.glsl"], true, errorLog);
            }

            _shaderProgramId = gl.createProgram();

            gl.attachShader(_shaderProgramId, vertexShader);
            gl.attachShader(_shaderProgramId, fragmentShader);
            gl.linkProgram(_shaderProgramId);

            if (!gl.getProgramParameter(_shaderProgramId, c.GL_LINK_STATUS)) {
                errorLog("Could not initialise shaders");
                return false;
            }

            gl.useProgram(_shaderProgramId);
            gl.boundShader = _shaderProgramId;
            activeUniforms = gl.getProgramParameter( _shaderProgramId, c.GL_ACTIVE_UNIFORMS);
            /**
             * Array of Object with size,type, name and index properties
             * @property activeUniforms
             * @type Object
             */
            this.activeUniforms = new Array(activeUniforms);
            /**
             * Lookup of uniform based on name.
             * @property uniformMap
             * @type Object
             */
            this.lookupUniform = {};
            for (i=0;i<activeUniforms;i++) {
                var uniform = gl.getActiveUniform(_shaderProgramId,i);
                this.activeUniforms[i] = {
                    size: uniform.size,
                    type: uniform.type,
                    name: uniform.name,
                    location: gl.getUniformLocation(_shaderProgramId,uniform.name)
                };
                this.lookupUniform[uniform.name] = this.activeUniforms[i];
            }

            activeAttributes = gl.getProgramParameter( _shaderProgramId, c.GL_ACTIVE_ATTRIBUTES);
            /**
             * Array of JSON data with size,type and name
             * @property activeAttributes
             * @type Array[Object]
             */
            this.activeAttributes = new Array(activeAttributes);
            /**
             * Lookup of attribute location based on name.
             * @property lookupAttribute
             * @type Object
             */
            this.lookupAttribute = {};
            for (i=0;i<activeAttributes;i++) {
                attribute = gl.getActiveAttrib(_shaderProgramId,i);
                this.activeAttributes[i] = {
                    size: attribute.size,
                    type: attribute.type,
                    name: attribute.name
                };
                this.lookupAttribute[attribute.name] = i;
            }

            thisObj.markUniformUpdated();

            return !compileError;
        };

        /**
         * Deletes the shader program from memory.
         * A destroyed shader can be used again if update shader is called
         * @method destroy
         */
        this.destroy = function(){
            if (_shaderProgramId!==-1){
                gl.deleteProgram(_shaderProgramId);
                _shaderProgramId = -1;
                engine.project.removeResourceDescriptor(thisObj.uid);
            }
        };

        /**
         * Return true if the shader compiled successfully and is not destroyed
         * @method isValid
         * @return {Boolean} is shader valid
         */
        this.isValid = function(){
            return _shaderProgramId!==-1;
        };

        /**
         * @method bind
         */
        this.bind = function () {
            if (KICK.core.Constants._ASSERT){
                if (!(this.isValid)){
                    KICK.core.Util.fail("Cannot bind a shader that is not valid");
                }
            }
            if (gl.boundShader !== _shaderProgramId){
                gl.boundShader = _shaderProgramId;
                gl.useProgram(_shaderProgramId);
                updateCullFace();
                updateDepthProperties();
                updateBlending();
            }
        };

        /**
         * Serializes the data into a JSON object (that can be used as a config parameter in the constructor)<br>
         * Note errorLog are not serialized
         * @method toJSON
         * @return {Object} config element
         */
        this.toJSON = function(){
            if (_dataURI){
                return {
                    uid: thisObj.uid,
                    name:_name,
                    dataURI:_dataURI
                }
            }
            // todo fill in missing attributes
            return {
                uid: thisObj.uid,
                name:_name,
                faceCulling:_faceCulling,
                zTest:_zTest,
                depthMask: _depthMask,
                vertexShaderSrc:_vertexShaderSrc,
                fragmentShaderSrc:_fragmentShaderSrc
            };
        };

        (function init(){
            applyConfig(thisObj,config);
            engine.project.registerObject(thisObj, "KICK.material.Shader");
            if (_dataURI){
                engine.resourceManager.getShaderData(_dataURI,thisObj);
            } else {
                updateBlendKey();
                thisObj.updateShader();
            }
        })();
    };


    /**
     * @method getPrecompiledSource
     * @param {String} sourcecode
     * @return {String} sourcecode after precompiler
     * @static
     */
    material.Shader.getPrecompiledSource = function(sourcecode){
        // todo optimize with regular expression search
        if (c._DEBUG){
            // insert #line nn after each #pragma include to give meaning full lines in error console
            var linebreakPosition = [];
            var position = sourcecode.indexOf('\n');
            while (position != -1){
                position++;
                linebreakPosition.push(position);
                position = sourcecode.indexOf('\n',position);
            }
            for (var i=linebreakPosition.length-2;i>=0;i--){
                position = linebreakPosition[i];
                var nextPosition = linebreakPosition[i+1];
                if (sourcecode.substring(position).indexOf("#pragma include")==0){
                    sourcecode = sourcecode.substring(0,nextPosition)+("#line  "+(i+2)+"\n")+sourcecode.substring(nextPosition);
                }
            }
        }
        for (var name in material.GLSLConstants){
            if (typeof (name) === "string"){
                var source = material.GLSLConstants[name];
                sourcecode = sourcecode.replace("#pragma include \""+name+"\"",source);
                sourcecode = sourcecode.replace("#pragma include \'"+name+"\'",source);
            }
        }
        return sourcecode;
    };

    Object.freeze(material.Shader);

    /**
     * Binds the uniforms to the current shader.
     * The uniforms is expected to be in a valid format
     * @method bindUniform
     * @param {KICK.material.Material} material
     * @param {KICK.math.mat4} projectionMatrix
     * @param {KICK.math.mat4} modelViewMatrix
     * @param {KICK.math.mat4} modelViewProjectionMatrix
     * @param {KICK.math.mat4) transform
     * @param {KICK.scene.SceneLights} sceneLights
     */
    material.Shader.prototype.bindUniform = function(material, projectionMatrix,modelViewMatrix,modelViewProjectionMatrix,transform, sceneLights){
        // todo optimize this code
        var gl = this.gl,
            materialUniforms = material.uniforms,
            timeObj,
            uniformName,
            shaderUniform,
            uniform,
            value,
            location,
            mv = this.lookupUniform["_mv"],
            proj = this.lookupUniform["_proj"],
            mvProj = this.lookupUniform["_mvProj"],
            norm = this.lookupUniform["_norm"],
            lightUniform,
            time = this.lookupUniform["_time"],
            viewport = this.lookupUniform["_viewport"],
            ambientLight = sceneLights.ambientLight,
            directionalLight = sceneLights.directionalLight,
            otherLights = sceneLights.otherLights,
            globalTransform,
            c = KICK.core.Constants,
            i,
            currentTexture = 0;

        for (uniformName in materialUniforms){
            shaderUniform = this.lookupUniform[uniformName];
            if (shaderUniform){ // if shader has a uniform with uniformName
                uniform = materialUniforms[uniformName];
                location = shaderUniform.location;
                value = uniform.value;
                switch (shaderUniform.type){
                    case c.GL_FLOAT:
                        gl.uniform1fv(location,value);
                        break;
                    case c.GL_FLOAT_MAT2:
                        gl.uniformMatrix2fv(location,false,value);
                        break;
                    case c.GL_FLOAT_MAT3:
                        gl.uniformMatrix3fv(location,false,value);
                        break;
                    case c.GL_FLOAT_MAT4:
                        gl.uniformMatrix4fv(location,false,value);
                        break;
                    case c.GL_FLOAT_VEC2:
                        gl.uniform2fv(location,value);
                        break;
                    case c.GL_FLOAT_VEC3:
                        gl.uniform3fv(location,value);
                        break;
                    case c.GL_FLOAT_VEC4:
                        gl.uniform4fv(location,value);
                        break;
                    case c.GL_INT:
                        gl.uniform1iv(location,value);
                        break;
                    case c.GL_INT_VEC2:
                        gl.uniform2iv(location,value);
                        break;
                    case c.GL_INT_VEC3:
                        gl.uniform3iv(location,value);
                        break;
                    case c.GL_INT_VEC4:
                        gl.uniform4iv(location,value);
                        break;
                    case c.GL_SAMPLER_CUBE:
                    case c.GL_SAMPLER_2D:
                        value.bind(currentTexture);
                        gl.uniform1i(location,currentTexture);
                        currentTexture ++;
                        break;
                    default:
                        console.log("Warn cannot find type "+shaderUniform.type);
                        break;
                }
            }
        }
        if (proj){
            gl.uniformMatrix4fv(proj.location,false,projectionMatrix);
        }
        if (mv || norm){
            // todo optimize
            globalTransform = transform.getGlobalMatrix();
            var finalModelView = mat4.multiply(modelViewMatrix,globalTransform,mat4.create());
            if (mv){
                gl.uniformMatrix4fv(mv.location,false,finalModelView);
            }
            if (norm){
                // note this can be simplified to
                // var normalMatrix = math.mat4.toMat3(finalModelView);
                // if the modelViewMatrix is orthogonal (non-uniform scale is not applied)
//                var normalMatrix = mat3.transpose(mat4.toInverseMat3(finalModelView));
                var normalMatrix = mat4.toNormalMat3(finalModelView);
                gl.uniformMatrix3fv(norm.location,false,normalMatrix);
            }
        }
        if (mvProj){
            globalTransform = globalTransform || transform.getGlobalMatrix();
            gl.uniformMatrix4fv(mvProj.location,false,mat4.multiply(modelViewProjectionMatrix,globalTransform,mat4.create())); // todo remove new mat4 here (make local variable?)
        }
        if (ambientLight !== null){
            lightUniform =  this.lookupUniform["_ambient"];
            if (lightUniform){
                gl.uniform3fv(lightUniform.location, ambientLight.colorIntensity);
            }
        }
        if (directionalLight !== null){
            lightUniform =  this.lookupUniform["_dLight.colInt"];
            if (lightUniform){
                gl.uniform3fv(lightUniform.location, directionalLight.colorIntensity);
                lightUniform =  this.lookupUniform["_dLight.lDir"];
                gl.uniform3fv(lightUniform.location, sceneLights.directionalLightDirection);
                lightUniform =  this.lookupUniform["_dLight.halfV"];
                gl.uniform3fv(lightUniform.location, sceneLights.directionalHalfVector);
            }
        }
        for (i=otherLights.length-1;i >= 0;i--){
            // todo
        }
        if (time){
            timeObj = this.engine.time;
            gl.uniform1f(time.location, timeObj.time);
        }
        if (viewport){
            gl.uniform2fv(viewport.location, gl.viewportSize);
        }
    };


    /**
     * Material configuration
     * @class Material
     * @namespace KICK.material
     * @constructor
     * @param {KICK.core.Engine} engine
     * @param {Object} config
     * @extends KICK.core.ProjectAsset
     */
    material.Material = function (engine,config) {
        var _name = "Material",
            _shader = null,
            _uniforms = {},
            thisObj = this,
            _renderOrder,
            gl = engine.gl;
        Object.defineProperties(this,{
             /**
              * @property name
              * @type String
              */
             name:{
                 get:function(){return _name;},
                 set:function(newValue){_name = newValue;}
             },
            /**
             * Also allows string - this will be used to lookup the shader in engine.project 
             * @property shader
             * @type KICK.material.Shader
             */
            shader:{
                get:function(){
                    return _shader;
                },
                set:function(newValue){
                    _shader = newValue;
                    thisObj.init();
                }
            },
            /**
             * Object with of uniforms.
             * The object has a number of named properties one for each uniform. The uniform object contains value and type.
             * The value is always an array<br>
             * Note when updating the uniform value, it is important to call the material.shader.markUniformUpdated().
             * When the material.uniform is set to something the markUniformUpdated function is implicit called.
             * @property uniforms
             * @type Object
             */
            uniforms:{
                get:function(){
                    return _uniforms;
                },
                set:function(newValue){
                    _uniforms = newValue;
                    if (_shader){
                        _shader.markUniformUpdated();
                    }
                }
            },
            /**
             * @property renderOrder
             * @type Number
             */
            renderOrder:{
                get:function(){
                    return _renderOrder;
                }
            }
        });

        /**
         * @method destroy
         */
        this.destroy = function(){
            engine.project.removeResourceDescriptor(thisObj.uid);
        };

        /**
         * Initialize the material
         * If the shader property is a string the shader is found in the engine.project.
         * If shader is invalid, the error shader is used
         * @method init
         */
        this.init = function(){
            if (typeof _shader === 'string'){
                _shader = engine.project.load(_shader);
            }
            if (!_shader){
                KICK.core.Util.fail("Cannot initiate shader in material "+_name);
                _shader = engine.project.load("kickjs://shader/error/");
            }
            _renderOrder = _shader.renderOrder;
        };

        /**
         * Binds textures and uniforms
         * @method bind
         */
        this.bind = function(projectionMatrix,modelViewMatrix,modelViewProjectionMatrix,transform, sceneLights){
            _shader.bindUniform (thisObj, projectionMatrix,modelViewMatrix,modelViewProjectionMatrix,transform, sceneLights);
        };

        /**
         * Returns a JSON representation of the material<br>
         * @method toJSON
         * @return {string}
         */
        this.toJSON = function(){
            var filteredUniforms = {};
            for (var name in _uniforms){
                if (typeof name === 'string'){
                    var uniform = _uniforms[name],
                        value = uniform.value;
                    if (value instanceof Float32Array || value instanceof Int32Array) {
                        value = core.Util.typedArrayToArray(value);
                    } else {
                        if (KICK.core.Constants._ASSERT){
                            if (!value instanceof KICK.texture.Texture){
                                KICK.core.Util.fail("Unknown uniform value type. Expected Texture");
                            }
                        }
                        value = KICK.core.Util.getJSONReference(engine,value);
                    }

                    filteredUniforms[name] = {
                        type: uniform.type,
                        value:value
                    };
                }
            }
            return {
                uid: thisObj.uid,
                name:_name,
                uniforms: filteredUniforms
            };
        };

        (function init(){
            applyConfig(thisObj,config);
            engine.project.registerObject(thisObj, "KICK.material.Material");
            // replace references to images with references
            for (var name in _uniforms){
                var uniformType = _uniforms[name].type;
                var uniformValue = _uniforms[name].value;
                if ((uniformType === KICK.core.Constants.GL_SAMPLER_2D ||
                    uniformType === KICK.core.Constants.GL_SAMPLER_CUBE ) && uniformValue && typeof uniformValue.ref === 'number'){
                    _uniforms[name].value = engine.project.load(uniformValue.ref);
                }
            }
            material.Material.verifyUniforms(_uniforms);
        })();
    };

    /**
     * The method replaces any invalid uniform (Array) with a wrapped one (Float32Array or Int32Array)
     * @method verifyUniforms
     * @param {Object} uniforms
     * @static
     */
    material.Material.verifyUniforms = function(uniforms){
        var uniform,
            type,
            c = KICK.core.Constants;
        for (uniform in uniforms){
            if (Array.isArray(uniforms[uniform].value) || typeof uniforms[uniform].value === 'number'){
                type = uniforms[uniform].type;
                if (type === c.GL_INT || type===c.GL_INT_VEC2 || type===c.GL_INT_VEC3 || type===c.GL_INT_VEC4){
                    uniforms[uniform].value = new Int32Array(uniforms[uniform].value);
                } else if (type === c.GL_SAMPLER_2D || type ===c.GL_SAMPLER_CUBE ){
                    if (c._ASSERT){
                        if (typeof uniforms[uniform].value !== KICK.texture.Texture){
                            KICK.core.Util.fail("Uniform value should be a texture object but was "+uniforms[uniform].value);
                        }
                    }
                } else {
                    uniforms[uniform].value = new Float32Array(uniforms[uniform].value);
                }
            }
        }
    };
})();
