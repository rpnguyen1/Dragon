import {tiny} from '../tiny-graphics.js';
// Pull these names into this module's scope for convenience:
const {Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4, Shape, Shader, Component} = tiny;

const defs = {};

export {tiny, defs};


const Basicer_Shader = defs.Basicer_Shader =
  class Basicer_Shader extends Shader {
      shared_glsl_code () {           // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
          return "#version 300 es " + `
                  precision mediump float;
      `;
      }
      vertex_glsl_code () {          // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        layout(location = 0) in vec3 position;
        void main() {
          gl_Position = vec4( position, 1.0 );
        }`;
      }
      fragment_glsl_code () {         // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        out vec4 frag_color;
        void main() {
          frag_color = vec4(1.0, 0.0, 0.0, 1.0);
        }`;
      }
  };

const Basic_Shader = defs.Basic_Shader =
  class Basic_Shader extends Shader {
      // Basic_Shader is nearly the simplest way to subclass Shader, which stores and manages a GPU program.
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          // update_GPU():  Define how to synchronize our JavaScript's variables to the GPU's:
          const [P, C, M] = [uniforms.projection_transform, uniforms.camera_inverse, model_transform],
                PCM       = P.times (C).times (M);
          context.uniformMatrix4fv (gpu_addresses.projection_camera_model_transform, false,
                                    Matrix.flatten_2D_to_1D (PCM.transposed ()));
      }
      shared_glsl_code () {           // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
          return `precision mediump float;
                  varying vec4 VERTEX_COLOR;
      `;
      }
      vertex_glsl_code () {          // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        attribute vec4 color;
        attribute vec3 position;                            // Position is expressed in object coordinates.
        uniform mat4 projection_camera_model_transform;

        void main() { 
          gl_Position = projection_camera_model_transform * vec4( position, 1.0 );      // Move vertex to final space.
          VERTEX_COLOR = color;                                 // Use the hard-coded color of the vertex.
        }`;
      }
      fragment_glsl_code () {         // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        void main() {                                                   
          gl_FragColor = VERTEX_COLOR;    // Directly use per-vertex colors for interpolation.
        }`;
      }
  };
  const Instanced_Shader = defs.Instanced_Shader =
  class Instanced_Shader extends Shader {
      constructor (num_lights = 2) {
        super ();
        this.num_lights = num_lights;

        this.ubo_binding = [
          {shader_name: "Material",  binding_point: 2},
        ];

        this.ubo_layout = [
          {num_instances: 1,
           data_layout:[{name:"color", type:"vec4"},
                        {name:"diffuse", type:"vec3"},
                        {name:"specular", type:"vec3"},
                        {name:"smoothness", type:"float"}]
          }
         ];
      }

      copy_onto_graphics_card (context) {
        const instance = super.copy_onto_graphics_card (context);
        this.init_UBO (context, this.gpu_instances.get(context).program, this.ubo_binding);
        return instance;
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
        material.initialize(context, this.ubo_layout);
        material.bind(this.ubo_binding[0].binding_point);
        context.uniformMatrix4fv (gpu_addresses.global_transform, true, Matrix.flatten_2D_to_1D (model_transform));
      }
      static default_values () {
        return {
                color: vec4 (1.0, 1.0, 1.0, 1.0),
                ambient: 1.0,
                diffuse: vec3(1.0, 1.0, 1.0),
                specular: vec3 (1.0, 1.0, 1.0),
                smoothness: 32.0
              };
      }
      // Basic_Shader is nearly the simplest way to subclass Shader, which stores and manages a GPU program.
      shared_glsl_code () {           // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
          return "#version 300 es " + `
                  precision mediump float;
      `;
      }
      vertex_glsl_code () {          // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        layout(location = 0) in vec3 position; // Position is expressed in object coordinates
        layout(location = 1) in vec3 normal;
        layout(location = 2) in vec2 texture_coord;
        layout(location = 3) in mat4 matrix;

        uniform mat4 global_transform;

        layout (std140) uniform Camera
        {
          mat4 view;
          mat4 projection;
          vec3 camera_position;
        };

        out vec3 VERTEX_POS;
        out vec3 VERTEX_NORMAL;
        out vec2 VERTEX_TEXCOORD;

        void main() {
          gl_Position =  projection * view * global_transform * transpose(matrix) * vec4( position, 1.0 );
          VERTEX_POS = vec3(global_transform * transpose(matrix) * vec4( position, 1.0 ));
          VERTEX_NORMAL = mat3(transpose(inverse(global_transform * transpose(matrix)))) * normal;
          VERTEX_TEXCOORD = texture_coord;
        }`;
      }
      fragment_glsl_code () {         // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `

        layout (std140) uniform Camera
        {
          mat4 view;
          mat4 projection;
          vec3 camera_position;
        };

        struct Light
        {
          vec4 direction_or_position;
          vec3 color;
          float diffuse;
          float specular;
          float attenuation_factor;
          bool casts_shadow;
        };

        const int N_LIGHTS = ` + this.num_lights + `;

        layout (std140) uniform Lights
        {
          float ambient;
          Light lights[N_LIGHTS];
          mat4 light_space_matrix[N_LIGHTS * 6];
        };

        layout (std140) uniform Material
        {
          vec4 color;
          vec3 diffuse;
          vec3 specular;
          float smoothness;
        };

        in vec3 VERTEX_POS;
        in vec3 VERTEX_NORMAL;
        in vec2 VERTEX_TEXCOORD;

        out vec4 frag_color;


        // ***** PHONG SHADING HAPPENS HERE: *****
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ) {
            vec3 E = normalize( camera_position - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++) {
                vec3 surface_to_light_vector = lights[i].direction_or_position.xyz -
                                               lights[i].direction_or_position.w * vertex_worldspace;
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );

                  // Compute diffuse and specular components of Phong Reflection Model.
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );     // Use Blinn's "halfway vector" method.
                float attenuation = 1.0 / (1.0 + lights[i].attenuation_factor * distance_to_light * distance_to_light );


                vec3 light_contribution = color.xyz * lights[i].color.xyz * diffuse * lights[i].diffuse * diffuse
                                                          + lights[i].color.xyz * specular * lights[i].specular * specular;

                result += attenuation * light_contribution;
              }
            return result;
          }

        void main() {
          // Compute an initial (ambient) color:
          frag_color = vec4( color.xyz * ambient, color.w );
          // Compute the final color with contributions from lights:
          frag_color.xyz += phong_model_lights( normalize( VERTEX_NORMAL ), VERTEX_POS );
        }`;
      }
  };

  const Textured_Instanced_Shader = defs.Textured_Instanced_Shader =
  class Textured_Instanced_Shader extends Instanced_Shader {
      constructor (num_lights = 2) {
        super ();
        this.num_lights = num_lights;

        this.ubo_binding = [
          {shader_name: "Material",  binding_point: 2},
        ];

        this.ubo_layout = [
          {num_instances: 1,
           data_layout:[{name:"color", type:"vec4"},
                        {name:"diffuse", type:"vec3"},
                        {name:"specular", type:"vec3"},
                        {name:"smoothness", type:"float"}]
          }
         ];
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
        material.initialize(context, this.ubo_layout);
        material.bind(this.ubo_binding[0].binding_point);
        context.uniformMatrix4fv (gpu_addresses.global_transform, true, Matrix.flatten_2D_to_1D (model_transform));
      }
      fragment_glsl_code () {         // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `

        layout (std140) uniform Camera
        {
          mat4 view;
          mat4 projection;
          vec3 camera_position;
        };

        struct Light
        {
          vec4 direction_or_position;
          vec3 color;
          float diffuse;
          float specular;
          float attenuation_factor;
          bool casts_shadow;
        };

        const int N_LIGHTS = ` + this.num_lights + `;

        layout (std140) uniform Lights
        {
          float ambient;
          Light lights[N_LIGHTS];
          mat4 light_space_matrix[N_LIGHTS * 6];
        };

        layout (std140) uniform Material
        {
          vec4 color;
          vec3 diffuse;
          vec3 specular;
          float smoothness;
        };

        uniform sampler2D diffuse_texture;

        in vec3 VERTEX_POS;
        in vec3 VERTEX_NORMAL;
        in vec2 VERTEX_TEXCOORD;

        out vec4 frag_color;

        float getFogFactor(float d)
        {
          const float FogMax = 100.0;
          const float FogMin = 0.0;

          if (d>=FogMax) return 1.0;
          if (d<=FogMin) return 0.0;

          return 1.0 - (FogMax - d) / (FogMax - FogMin);
        }

        // ***** PHONG SHADING HAPPENS HERE: *****
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ) {
            vec3 E = normalize( camera_position - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++) {
                vec3 surface_to_light_vector = lights[i].direction_or_position.xyz -
                                               lights[i].direction_or_position.w * vertex_worldspace;
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );

                  // Compute diffuse and specular components of Phong Reflection Model.
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );     // Use Blinn's "halfway vector" method.
                float attenuation = 1.0 / (1.0 + lights[i].attenuation_factor * distance_to_light * distance_to_light );

                vec4 color = texture( diffuse_texture, VERTEX_TEXCOORD );
                vec3 light_contribution = color.xyz * lights[i].color.xyz * diffuse * lights[i].diffuse * diffuse
                                                          + lights[i].color.xyz * specular * lights[i].specular * specular;

                result += attenuation * light_contribution;
              }
            return result;
          }

        void main() {
          // Compute an initial (ambient) color:
          vec4 tex_color = texture( diffuse_texture, VERTEX_TEXCOORD );
          frag_color = vec4( ( tex_color.xyz ) * ambient, tex_color.w );
          // Compute the final color with contributions from lights:
          frag_color.xyz += phong_model_lights( normalize( VERTEX_NORMAL ), VERTEX_POS );

          //Blue for depth distance
          #define LOG2 1.442695
          float fogDensity = 0.011;
          float fogDistance = length(camera_position - VERTEX_POS);
          float fogAmount = 1. - exp2(-fogDensity * fogDensity * fogDistance * fogDistance * LOG2);
          fogAmount = clamp(fogAmount, 0., 1.);
          vec4 fog_color = vec4 (0.0, 0.41, 0.58, 1.0);
          frag_color = mix(frag_color, fog_color, fogAmount);
        }`;
      }
  };
  const Shadow_Pass_Shader = defs.Shadow_Pass_Shader =
  class Shadow_Pass_Shader extends Shader {
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {

        if(uniforms.light_space_matrix)
          context.uniformMatrix4fv (gpu_addresses.light_space_matrix, true, Matrix.flatten_2D_to_1D (uniforms.light_space_matrix));
        context.uniformMatrix4fv (gpu_addresses.global_transform, true, Matrix.flatten_2D_to_1D (model_transform));
      }
      shared_glsl_code () {           // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return "#version 300 es " + `
                precision mediump float;
        `;
      }
      vertex_glsl_code () {          // ********* VERTEX SHADER *********
        return this.shared_glsl_code () + `
      layout(location = 0) in vec3 position; // Position is expressed in object coordinates
      layout(location = 3) in mat4 matrix;

      uniform mat4 global_transform;
      uniform mat4 light_space_matrix;

      layout (std140) uniform Camera
      {
        mat4 view;
        mat4 projection;
        vec3 camera_position;
      };

      void main() {
        gl_Position =  light_space_matrix * global_transform * transpose(matrix) * vec4( position, 1.0 );
      }`;
    }
      fragment_glsl_code () {         // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `

        void main() {
        }`;
      }
  };

  const Shadow_Instanced_Shader = defs.Shadow_Instanced_Shader =
  class Shadow_Instanced_Shader extends Instanced_Shader {
      constructor (num_lights = 2) {
        super ();
        this.num_lights = num_lights;

        this.ubo_binding = [
          {shader_name: "Material",  binding_point: 2},
        ];

        this.ubo_layout = [
          {num_instances: 1,
           data_layout:[{name:"color", type:"vec4"},
                        {name:"diffuse", type:"vec3"},
                        {name:"specular", type:"vec3"},
                        {name:"smoothness", type:"float"}]
          }
         ];
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
        material.initialize(context, this.ubo_layout);
        material.bind(this.ubo_binding[0].binding_point);
        context.uniformMatrix4fv (gpu_addresses.global_transform, true, Matrix.flatten_2D_to_1D (model_transform));
        for (let light of uniforms.lights) {
          light.bind(context, gpu_addresses);
        }
      }
      fragment_glsl_code () {         // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        layout (std140) uniform Camera
        {
          mat4 view;
          mat4 projection;
          vec3 camera_position;
        };

        struct Light
        {
          vec4 direction_or_position;
          vec3 color;
          float diffuse;
          float specular;
          float attenuation_factor;
          bool casts_shadow;
        };

        const int N_LIGHTS = ` + this.num_lights + `;

        layout (std140) uniform Lights
        {
          float ambient;
          Light lights[N_LIGHTS];
          mat4 light_space_matrix[N_LIGHTS * 6];
        };

        const int NUM_SHADOW_MAPS = N_LIGHTS * 6;

        //uniform sampler2D shadow_maps[NUM_SHADOW_MAPS]; //since point lights have up to 6 samplers
        uniform sampler2D shadow_maps;

        layout (std140) uniform Material
        {
          vec4 color;
          vec3 diffuse;
          vec3 specular;
          float smoothness;
        };

        in vec3 VERTEX_POS;
        in vec3 VERTEX_NORMAL;
        in vec2 VERTEX_TEXCOORD;

        out vec4 frag_color;

        float ShadowCalculation(vec4 fragPosLightSpace, int index, vec3 N, vec3 L )
        {


          // perform perspective divide
          vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;

          // transform to [0,1] range
          projCoords = projCoords * 0.5 + 0.5;

          if( projCoords.x < 0.0 || projCoords.y < 0.0 || projCoords.x > 1.0 || projCoords.y > 1.0 )
            return 0.0;


          // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
          // float closestDepth = texture(shadow_maps[i*6], projCoords.xy).r;
          //float closestDepth = texture(shadow_maps[0], projCoords.xy).r;
          float closestDepth = texture(shadow_maps, projCoords.xy).r;

          // get depth of current fragment from light's perspective
          float currentDepth = projCoords.z;


          // calculate bias (based on depth map resolution and slope)
          float bias = max(0.05 * (1.0 - dot(N, L)), 0.005);

          // WITHOUT PCF - check whether current frag pos is in shadow
          // float shadow = currentDepth - bias > closestDepth  ? 1.0 : 0.0;

          // PCF
          float shadow = 0.0;
          vec2 temp = vec2(textureSize(shadow_maps, 0));
          vec2 texelSize = 1.0 / temp;
          for(int x = -1; x <= 1; ++x)
          {
              for(int y = -1; y <= 1; ++y)
              {
                  float pcfDepth = texture(shadow_maps, projCoords.xy + vec2(x, y) * texelSize).r;
                  shadow += currentDepth - bias > pcfDepth  ? 1.0 : 0.0;
              }
          }
          shadow /= 9.0;

          // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
          if(projCoords.z > 1.0)
              shadow = 0.0;


            return shadow;
        }

        // ***** PHONG SHADING HAPPENS HERE: *****
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ) {
            vec3 E = normalize( camera_position - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++) {
                vec3 surface_to_light_vector = lights[i].direction_or_position.xyz -
                                               lights[i].direction_or_position.w * vertex_worldspace;
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );

                  // Compute diffuse and specular components of Phong Reflection Model.
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );     // Use Blinn's "halfway vector" method.
                float attenuation = 1.0 / (1.0 + lights[i].attenuation_factor * distance_to_light * distance_to_light );

                vec3 light_contribution = color.xyz * lights[i].color.xyz * diffuse * lights[i].diffuse * diffuse
                                                          + lights[i].color.xyz * specular * lights[i].specular * specular;

                vec4 fragPosLightSpace = light_space_matrix[i * 6] * vec4 (VERTEX_POS, 1.0);



               float shadow = ShadowCalculation(fragPosLightSpace, i, N, L);
               result += attenuation * (1.0 - shadow) * light_contribution;
              }
            return result;
          }

        void main() {
          // Compute an initial (ambient) color:
          frag_color = vec4( ( color.xyz ) * ambient, color.w );
          // Compute the final color with contributions from lights:
          frag_color.xyz += phong_model_lights( normalize( VERTEX_NORMAL ), VERTEX_POS );

          //Blue for depth distance
          #define LOG2 1.442695
          float fogDensity = 0.009;
          float fogDistance = length(camera_position - VERTEX_POS);
          float fogAmount = 1. - exp2(-fogDensity * fogDensity * fogDistance * fogDistance * LOG2);
          fogAmount = clamp(fogAmount, 0., 1.);
          vec4 fog_color = vec4 (0.0, 0.41, 0.58, 1.0);
          frag_color = mix(frag_color, fog_color, fogAmount);
        }`;
      }
  };

  const Shadow_Textured_Instanced_Shader = defs.Shadow_Textured_Instanced_Shader =
  class Shadow_Textured_Instanced_Shader extends Instanced_Shader {
      constructor (num_lights = 2) {
        super ();
        this.num_lights = num_lights;

        this.ubo_binding = [
          {shader_name: "Material",  binding_point: 2},
        ];

        this.ubo_layout = [
          {num_instances: 1,
           data_layout:[{name:"color", type:"vec4"},
                        {name:"diffuse", type:"vec3"},
                        {name:"specular", type:"vec3"},
                        {name:"smoothness", type:"float"}]
          }
         ];
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
        material.initialize(context, this.ubo_layout);
        material.bind(this.ubo_binding[0].binding_point);
        context.uniformMatrix4fv (gpu_addresses.global_transform, true, Matrix.flatten_2D_to_1D (model_transform));
        for (let light of uniforms.lights) {
          light.bind(context, gpu_addresses);
        }
      }
      fragment_glsl_code () {         // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        layout (std140) uniform Camera
        {
          mat4 view;
          mat4 projection;
          vec3 camera_position;
        };

        struct Light
        {
          vec4 direction_or_position;
          vec3 color;
          float diffuse;
          float specular;
          float attenuation_factor;
          bool casts_shadow;
        };

        const int N_LIGHTS = ` + this.num_lights + `;

        layout (std140) uniform Lights
        {
          float ambient;
          Light lights[N_LIGHTS];
          mat4 light_space_matrix[N_LIGHTS * 6];
        };

        const int NUM_SHADOW_MAPS = N_LIGHTS * 6;

        //uniform sampler2D shadow_maps[NUM_SHADOW_MAPS]; //since point lights have up to 6 samplers
        uniform sampler2D shadow_maps;

        layout (std140) uniform Material
        {
          vec4 color;
          vec3 diffuse;
          vec3 specular;
          float smoothness;
        };
        uniform sampler2D diffuse_texture;

        in vec3 VERTEX_POS;
        in vec3 VERTEX_NORMAL;
        in vec2 VERTEX_TEXCOORD;

        out vec4 frag_color;

        float ShadowCalculation(vec4 fragPosLightSpace, int index, vec3 N, vec3 L )
        {


          // perform perspective divide
          vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;

          // transform to [0,1] range
          projCoords = projCoords * 0.5 + 0.5;

          if( projCoords.x < 0.0 || projCoords.y < 0.0 || projCoords.x > 1.0 || projCoords.y > 1.0 )
            return 0.0;


          // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
          // float closestDepth = texture(shadow_maps[i*6], projCoords.xy).r;
          //float closestDepth = texture(shadow_maps[0], projCoords.xy).r;
          float closestDepth = texture(shadow_maps, projCoords.xy).r;

          // get depth of current fragment from light's perspective
          float currentDepth = projCoords.z;


          // calculate bias (based on depth map resolution and slope)
          float bias = max(0.05 * (1.0 - dot(N, L)), 0.005);

          // WITHOUT PCF - check whether current frag pos is in shadow
          // float shadow = currentDepth - bias > closestDepth  ? 1.0 : 0.0;

          // PCF
          float shadow = 0.0;
          vec2 temp = vec2(textureSize(shadow_maps, 0));
          vec2 texelSize = 1.0 / temp;
          for(int x = -1; x <= 1; ++x)
          {
              for(int y = -1; y <= 1; ++y)
              {
                  float pcfDepth = texture(shadow_maps, projCoords.xy + vec2(x, y) * texelSize).r;
                  shadow += currentDepth - bias > pcfDepth  ? 1.0 : 0.0;
              }
          }
          shadow /= 9.0;

          // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
          if(projCoords.z > 1.0)
              shadow = 0.0;


            return shadow;
        }

        // ***** PHONG SHADING HAPPENS HERE: *****
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ) {
            vec3 E = normalize( camera_position - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++) {
                vec3 surface_to_light_vector = lights[i].direction_or_position.xyz -
                                               lights[i].direction_or_position.w * vertex_worldspace;
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );

                  // Compute diffuse and specular components of Phong Reflection Model.
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );     // Use Blinn's "halfway vector" method.
                float attenuation = 1.0 / (1.0 + lights[i].attenuation_factor * distance_to_light * distance_to_light );

                vec4 color = texture( diffuse_texture, VERTEX_TEXCOORD );
                vec3 light_contribution = color.xyz * lights[i].color.xyz * diffuse * lights[i].diffuse * diffuse
                                                          + lights[i].color.xyz * specular * lights[i].specular * specular;

                vec4 fragPosLightSpace = light_space_matrix[i * 6] * vec4 (VERTEX_POS, 1.0);



               float shadow = ShadowCalculation(fragPosLightSpace, i, N, L);
               result += attenuation * (1.0 - shadow) * light_contribution;
              }
            return result;
          }

        void main() {
          // Compute an initial (ambient) color:
          vec4 tex_color = texture( diffuse_texture, VERTEX_TEXCOORD );
          frag_color = vec4( ( tex_color.xyz ) * ambient, tex_color.w );
          // Compute the final color with contributions from lights:
          frag_color.xyz += phong_model_lights( normalize( VERTEX_NORMAL ), VERTEX_POS );

          //Blue for depth distance
          #define LOG2 1.442695
          float fogDensity = 0.009;
          float fogDistance = length(camera_position - VERTEX_POS);
          float fogAmount = 1. - exp2(-fogDensity * fogDensity * fogDistance * fogDistance * LOG2);
          fogAmount = clamp(fogAmount, 0., 1.);
          // vec4 fog_color = vec4 (0.0, 0.41, 0.58, 1.0);
          vec4 fog_color = vec4 (1, 1, 1, 1.0);
          frag_color = mix(frag_color, fog_color, fogAmount);
        }`;
      }
  };
const Funny_Shader = defs.Funny_Shader =
  class Funny_Shader extends Shader {
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          const [P, C, M] = [uniforms.projection_transform, uniforms.camera_inverse, model_transform],
                PCM       = P.times (C).times (M);
          context.uniformMatrix4fv (gpu_addresses.projection_camera_model_transform, false,
                                    Matrix.flatten_2D_to_1D (PCM.transposed ()));
          context.uniform1f (gpu_addresses.animation_time, uniforms.animation_time / 1000);
      }
      shared_glsl_code () {
          return `precision mediump float;
                  varying vec2 f_tex_coord;
      `;
      }
      vertex_glsl_code () {
          return this.shared_glsl_code () + `
        attribute vec3 position;                            // Position is expressed in object coordinates.
        attribute vec2 texture_coord;
        uniform mat4 projection_camera_model_transform;

        void main() {
          gl_Position = projection_camera_model_transform * vec4( position, 1.0 );  // Move vertex to final space
          f_tex_coord = texture_coord;                 // Supply the original texture coords for interpolation.
        }`;
      }
      fragment_glsl_code () {
          return this.shared_glsl_code () + `
        uniform float animation_time;
        void main() { 
          float a = animation_time, u = f_tex_coord.x, v = f_tex_coord.y;
          
          // To color in all pixels, use an arbitrary math function based only on time and UV texture coordinates.
          gl_FragColor = vec4(                                    
            2.0 * u * sin(17.0 * u ) + 3.0 * v * sin(11.0 * v ) + 1.0 * sin(13.0 * a),
            3.0 * u * sin(18.0 * u ) + 4.0 * v * sin(12.0 * v ) + 2.0 * sin(14.0 * a),
            4.0 * u * sin(19.0 * u ) + 5.0 * v * sin(13.0 * v ) + 3.0 * sin(15.0 * a),
            5.0 * u * sin(20.0 * u ) + 6.0 * v * sin(14.0 * v ) + 4.0 * sin(16.0 * a));
        }`;
      }
  };


const Phong_Shader = defs.Phong_Shader =
  class Phong_Shader extends Shader {
      constructor (num_lights = 2) {
          super ();
          this.num_lights = num_lights;
      }
      shared_glsl_code () {          // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
          return ` 
        precision mediump float;
        const int N_LIGHTS = ` + this.num_lights + `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;

        varying vec3 N, vertex_worldspace;
                                             // ***** PHONG SHADING HAPPENS HERE: *****
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ) {
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++) {
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz -
                                               light_positions_or_vectors[i].w * vertex_worldspace;
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                
                  // Compute diffuse and specular components of Phong Reflection Model.
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );     // Use Blinn's "halfway vector" method.
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );


                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;

                result += attenuation * light_contribution;
              }
            return result;
          } `;
      }
      vertex_glsl_code () {           // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        attribute vec3 position, normal;                            // Position is expressed in object coordinates.

        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main() {                                                                
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );     // Move vertex to final space.
                                            // The final normal vector in screen space.
            N = normalize( mat3( model_transform ) * normal / squared_scale);

            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
          } `;
      }
      fragment_glsl_code () {          // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        void main() {                          
                                           // Compute an initial (ambient) color:
            gl_FragColor = vec4( shape_color.xyz * ambient, shape_color.w );
                                           // Compute the final color with contributions from lights:
            gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
          } `;
      }
      static light_source (position, color, size) {
          return {position, color, attenuation: 1 / size};
      }
      send_material (gl, gpu, material) {
          gl.uniform4fv (gpu.shape_color, material.color);
          gl.uniform1f (gpu.ambient, material.ambient);
          gl.uniform1f (gpu.diffusivity, material.diffusivity);
          gl.uniform1f (gpu.specularity, material.specularity);
          gl.uniform1f (gpu.smoothness, material.smoothness);
      }
      send_uniforms (gl, gpu, uniforms, model_transform) {
          const O = vec4 (0, 0, 0, 1), camera_center = uniforms.camera_transform.times (O).to3 ();
          gl.uniform3fv (gpu.camera_center, camera_center);

          // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
          const squared_scale = model_transform.reduce (
            (acc, r) => { return acc.plus (vec4 (...r).times_pairwise (r)); }, vec4 (0, 0, 0, 0)).to3 ();
          gl.uniform3fv (gpu.squared_scale, squared_scale);

          // Send the current matrices to the shader as a single pre-computed final matrix, the product.
          const PCM = uniforms.projection_transform.times (uniforms.camera_inverse).times (model_transform);
          gl.uniformMatrix4fv (gpu.model_transform, false, Matrix.flatten_2D_to_1D (model_transform.transposed ()));
          gl.uniformMatrix4fv (gpu.projection_camera_model_transform, false,
                               Matrix.flatten_2D_to_1D (PCM.transposed ()));

          if ( !uniforms.lights || !uniforms.lights.length)
              return;         // Lights omitted, ambient only

          const light_positions_flattened = [], light_colors_flattened = [];
          for (var i = 0; i < 4 * uniforms.lights.length; i++) {
              light_positions_flattened.push (uniforms.lights[ Math.floor (i / 4) ].position[ i % 4 ]);
              light_colors_flattened.push (uniforms.lights[ Math.floor (i / 4) ].color[ i % 4 ]);
          }
          gl.uniform4fv (gpu.light_positions_or_vectors, light_positions_flattened);
          gl.uniform4fv (gpu.light_colors, light_colors_flattened);
          gl.uniform1fv (gpu.light_attenuation_factors, uniforms.lights.map (l => l.attenuation));
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          const defaults    = {color: color (0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
          let full_material = Object.assign (defaults, material);

          this.send_material (context, gpu_addresses, full_material);
          this.send_uniforms (context, gpu_addresses, uniforms, model_transform);
      }
  };


const Textured_Phong = defs.Textured_Phong =
  class Textured_Phong extends Phong_Shader {
      vertex_glsl_code () {         // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        attribute vec3 position, normal;                            // Position is expressed in object coordinates.
        attribute vec2 texture_coord;

        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main() {
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );     // Move vertex to final space.
                                              // The final normal vector in screen space.
            N = normalize( mat3( model_transform ) * normal / squared_scale);

            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                                              // Turn the per-vertex texture coordinate into an interpolated variable.
            f_tex_coord = texture_coord;
          } `;
      }
      fragment_glsl_code () {        // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        uniform sampler2D texture;

        void main() {
            vec4 tex_color = texture2D( texture, f_tex_coord );       // Sample texture image in the correct place.
            if( tex_color.w < .01 ) discard;
                                                                     // Compute an initial (ambient) color:
            gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
                                                                     // Compute the final color with contributions from lights:
            gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
          } `;
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          super.update_GPU (context, gpu_addresses, uniforms, model_transform, material);

          if (material.texture && material.texture.ready) {
              // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
              context.uniform1i (gpu_addresses.texture, 0);
              // For this draw, use the texture image from correct the GPU buffer:
              material.texture.activate (context, 0);
          }
      }
  };

  const Textured_Phong_alpha = defs.Textured_Phong_alpha =
  class Textured_Phong_alpha extends Phong_Shader {
      vertex_glsl_code () {         // ********* VERTEX SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        attribute vec3 position, normal;                            // Position is expressed in object coordinates.
        attribute vec2 texture_coord;

        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main() {
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );     // Move vertex to final space.
                                              // The final normal vector in screen space.
            N = normalize( mat3( model_transform ) * normal / squared_scale);

            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                                              // Turn the per-vertex texture coordinate into an interpolated variable.
            f_tex_coord = texture_coord;
          } `;
      }
      fragment_glsl_code () {        // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        uniform sampler2D texture;
        uniform float animation_time;


        // Define sprite sheet size
        const float SPRITE_COLS = 6.0;  // 6 sprites per row
        const float SPRITE_ROWS = 6.0;  // 6 sprites per column
        const float TOTAL_FRAMES = SPRITE_COLS * SPRITE_ROWS;  // 36 frames


        void main() {
            vec2 f_tex_2 = f_tex_coord; // Base texture coordinates

            

            // Compute the current frame index (looping)
            float frame_index = floor(mod(animation_time * 50.0, TOTAL_FRAMES));

            // Determine sprite row and column (use float instead of int)
            float frame_x = mod(frame_index, SPRITE_COLS); // Column index
            float frame_y = -floor(frame_index / SPRITE_ROWS); // Row index
            // float frame_y = -6.0; // Row index

            // Normalize frame positions within the sprite sheet (0-1 range)
            vec2 sprite_size = vec2(1.0 / SPRITE_COLS, 1.0 / SPRITE_ROWS);
            vec2 sprite_offset = vec2(sprite_size.x * frame_x, sprite_size.y * frame_y);

            // Adjust texture coordinates to select the correct sprite
            vec2 f_tex_3 = f_tex_2 * sprite_size + sprite_offset;

            vec4 tex_color = texture2D( texture, f_tex_3 );      

            // if( tex_color.w < .01 ) discard;
            float darkness = 1.0 - length(tex_color.rgb); // 1 when black, 0 when white
            float alpha = tex_color.w * (1.0 - darkness); // Reduce alpha based on darkness

            if (alpha < 0.05) discard; // Optional: Fully discard near-zero alpha
            // gl_FragColor = vec4((tex_color.rgb + shape_color.rgb) * ambient, shape_color.a * alpha);

                                                                     // Compute an initial (ambient) color:
            gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ), shape_color.w * alpha);
                                                                     // Compute the final color with contributions from lights:
            gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
          } `;
      }
      update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
          super.update_GPU (context, gpu_addresses, uniforms, model_transform, material);

          if (material.texture && material.texture.ready) {
              // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
              context.uniform1i (gpu_addresses.texture, 0);
              // For this draw, use the texture image from correct the GPU buffer:
              material.texture.activate (context, 0);

              context.uniform1f(gpu_addresses.animation_time, uniforms.animation_time / 1000);
          }
      }
  };

const Fake_Bump_Map = defs.Fake_Bump_Map =
  class Fake_Bump_Map extends Textured_Phong {
      fragment_glsl_code () {                            // ********* FRAGMENT SHADER *********
          return this.shared_glsl_code () + `
        varying vec2 f_tex_coord;
        uniform sampler2D texture;

        void main()  {        
            vec4 tex_color = texture2D( texture, f_tex_coord );       // Sample texture image in the correct place.
            if( tex_color.w < .01 ) discard;
                            
            // This time, slightly disturb normals based on sampling the same image that was used for texturing.
            vec3 bumped_N  = N + tex_color.rgb - .5*vec3(1,1,1);
            gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
            gl_FragColor.xyz += phong_model_lights( normalize( bumped_N ), vertex_worldspace );
          } `;
      }
  };



  const Phong_Shader2 = defs.Phong_Shader2 = // with texture maps
  class Phong_Shader2 extends Shader {
    constructor (num_lights = 2) {
      super ();
      this.num_lights = num_lights;
  }
  shared_glsl_code () {          // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
      return ` 
    precision mediump float;
    const int N_LIGHTS = ` + this.num_lights + `;
    uniform float ambient, diffusivity, specularity, smoothness;
    uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
    uniform float light_attenuation_factors[N_LIGHTS];
    uniform vec4 shape_color;
    uniform vec3 squared_scale, camera_center;

    varying vec3 N, vertex_worldspace;
                                         // ***** PHONG SHADING HAPPENS HERE: *****
    vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ) {
        vec3 E = normalize( camera_center - vertex_worldspace );
        vec3 result = vec3( 0.0 );
        for(int i = 0; i < N_LIGHTS; i++) {
            vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz -
                                           light_positions_or_vectors[i].w * vertex_worldspace;
            float distance_to_light = length( surface_to_light_vector );

            vec3 L = normalize( surface_to_light_vector );
            vec3 H = normalize( L + E );
            
              // Compute diffuse and specular components of Phong Reflection Model.
            // float diffuse  =      max( dot( N, L ), 0.0 );
            float diffuse = max(dot(N, L), 0.0) * 1.0;
            // Fresnel-Schlick approximation for specular
            float fresnel_factor = 0.2; // Adjust this value to control the strength of the Fresnel effect
            float fresnel = fresnel_factor * pow(1.0 - max(dot(E, N), 0.0), 3.0);

            
            float specular = (1.0 - fresnel) * pow(max(dot(N, H), 0.0), smoothness) + fresnel;
            // float specular = pow( max( dot( N, H ), 0.0 ), smoothness );     // Use Blinn's "halfway vector" method.
            
            float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );

            vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                      + light_colors[i].xyz * specularity * specular;

            result += attenuation * light_contribution;
          }
        return result;
      } `;
  }
  vertex_glsl_code () {         // ********* VERTEX SHADER *********
    return this.shared_glsl_code () + `
  varying vec2 f_tex_coord;
  attribute vec3 position, normal;                            // Position is expressed in object coordinates.
  attribute vec2 texture_coord;

  uniform mat4 model_transform;
  uniform mat4 projection_camera_model_transform;

  void main() {
      gl_Position = projection_camera_model_transform * vec4( position, 1.0 );     // Move vertex to final space.
                                        // The final normal vector in screen space.
      N = normalize( mat3( model_transform ) * normal / squared_scale);

      vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                                        // Turn the per-vertex texture coordinate into an interpolated variable.
      f_tex_coord = texture_coord;
    } `;
}
fragment_glsl_code () {        // ********* FRAGMENT SHADER *********
  return this.shared_glsl_code () + `
varying vec2 f_tex_coord;
uniform sampler2D texture;

void main() {
    vec4 tex_color = texture2D( texture, f_tex_coord );       // Sample texture image in the correct place.
    if( tex_color.w < .01 ) discard;
                                                             // Compute an initial (ambient) color:
    gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
                                                             // Compute the final color with contributions from lights:
    gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
  } `;
}
  static light_source (position, color, size) {
      return {position, color, attenuation: 1 / size};
  }
  send_material (gl, gpu, material) {
      gl.uniform4fv (gpu.shape_color, material.color);
      gl.uniform1f (gpu.ambient, material.ambient);
      gl.uniform1f (gpu.diffusivity, material.diffusivity);
      gl.uniform1f (gpu.specularity, material.specularity);
      gl.uniform1f (gpu.smoothness, material.smoothness);
  }
  send_uniforms (gl, gpu, uniforms, model_transform) {
      const O = vec4 (0, 0, 0, 1), camera_center = uniforms.camera_transform.times (O).to3 ();
      gl.uniform3fv (gpu.camera_center, camera_center);

      // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
      const squared_scale = model_transform.reduce (
        (acc, r) => { return acc.plus (vec4 (...r).times_pairwise (r)); }, vec4 (0, 0, 0, 0)).to3 ();
      gl.uniform3fv (gpu.squared_scale, squared_scale);

      // Send the current matrices to the shader as a single pre-computed final matrix, the product.
      const PCM = uniforms.projection_transform.times (uniforms.camera_inverse).times (model_transform);
      gl.uniformMatrix4fv (gpu.model_transform, false, Matrix.flatten_2D_to_1D (model_transform.transposed ()));
      gl.uniformMatrix4fv (gpu.projection_camera_model_transform, false,
                           Matrix.flatten_2D_to_1D (PCM.transposed ()));

      if ( !uniforms.lights || !uniforms.lights.length)
          return;         // Lights omitted, ambient only

      const light_positions_flattened = [], light_colors_flattened = [];
      for (var i = 0; i < 4 * uniforms.lights.length; i++) {
          light_positions_flattened.push (uniforms.lights[ Math.floor (i / 4) ].position[ i % 4 ]);
          light_colors_flattened.push (uniforms.lights[ Math.floor (i / 4) ].color[ i % 4 ]);
      }
      gl.uniform4fv (gpu.light_positions_or_vectors, light_positions_flattened);
      gl.uniform4fv (gpu.light_colors, light_colors_flattened);
      gl.uniform1fv (gpu.light_attenuation_factors, uniforms.lights.map (l => l.attenuation));
  }
  update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
      const defaults    = {color: color (0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
      let full_material = Object.assign (defaults, material);

      this.send_material (context, gpu_addresses, full_material);
      this.send_uniforms (context, gpu_addresses, uniforms, model_transform);

      if (material.texture && material.texture.ready) {
        // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
        context.uniform1i (gpu_addresses.texture, 0);
        // For this draw, use the texture image from correct the GPU buffer:
        material.texture.activate (context, 0);
    }
  }
};


const Fog_Shader = defs.Fog_Shader =
  class Fog_Shader extends Phong_Shader2 {
    fragment_glsl_code () {                            // ********* FRAGMENT SHADER *********
      return this.shared_glsl_code () + `
    varying vec2 f_tex_coord;
    uniform sampler2D texture;
    // uniform float animation_time;

    void main()  {        
        vec2 f_tex_2 = f_tex_coord;
        vec2 f_tex_3 = vec2(f_tex_2.s, f_tex_2.t);


        // vec4 tex_color = texture2D( texture, f_tex_coord );       // Sample texture image in the correct place.
        vec4 tex_color = texture2D( texture, f_tex_3 );       // Sample texture image in the correct place.
        if( tex_color.w < .01 ) discard;
                        
        // This time, slightly disturb normals based on sampling the same image that was used for texturing.
        vec3 bumped_N  = N + tex_color.rgb - .5*vec3(1,1,1);
        gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
        gl_FragColor.xyz += phong_model_lights( normalize( bumped_N ), vertex_worldspace );
      
      
          //Blue for depth distance
          #define LOG2 1.442695
          float fogDensity = 0.009;
          float fogDistance = length(camera_center - vertex_worldspace);
          float fogAmount = 1. - exp2(-fogDensity * fogDensity * fogDistance * fogDistance * LOG2);
          fogAmount = clamp(fogAmount, 0., 1.);
          vec4 fog_color = vec4 (0.0, 0.41, 0.58, 1.0);
          // vec4 fog_color = vec4 (0.7, 0.7, 0.7, 1.0);
          gl_FragColor = mix(gl_FragColor, fog_color, fogAmount);
        } `;
  }
  update_GPU(context, gpu_addresses, uniforms, model_transform, material) {
    // update_GPU(): Add a little more to the base class's version of this method.
    super.update_GPU(context, gpu_addresses, uniforms, model_transform, material);
    // Updated for assignment 4
    // context.uniform1f(gpu_addresses.animation_time, uniforms.animation_time / 1000);
  }
}


const Scroll_Fog_Shader = defs.Scroll_Fog_Shader =
  class Scroll_Fog_Shader extends Phong_Shader2 {
    vertex_glsl_code () {         // ********* VERTEX SHADER *********
      return this.shared_glsl_code () + `
    varying vec2 f_tex_coord;
    attribute vec3 position, normal;                            // Position is expressed in object coordinates.
    attribute vec2 texture_coord;
  
    uniform mat4 model_transform;
    uniform mat4 projection_camera_model_transform;
    uniform float animation_time;  // animation_time uniform to animate the motion
    
    float noise(float x) {
      return sin(x) * 0.5 + 0.5;  // Simple oscillating noise-like function.
    }

    void main() {
      // Distorted wave: Using multiple sine functions + simple noise for distortion
        vec3 animated_position = position;

        float wave1 = sin(animation_time + position.x * 0.2) * 3.0;
        float wave2 = sin(animation_time * 0.5 + position.y * 0.3) * 1.3;
        float wave3 = sin(animation_time * 2.0 + position.z * 0.1) * 2.2;

        // Add noise-based distortion
        float noise_factor = noise(animation_time + position.x * 0.5) * 0.1;  // Noise modulates the wave
        animated_position.y += wave1 + wave2 + wave3 + noise_factor; // Add the distortion
        // animated_position.y += wave1; // Add the distortion

        gl_Position = projection_camera_model_transform * vec4( animated_position, 1.0 );     
        
        N = normalize( mat3( model_transform ) * normal / squared_scale);

        vertex_worldspace = ( model_transform * vec4( animated_position, 1.0 ) ).xyz;
        f_tex_coord = texture_coord;
      } `;
  }
    fragment_glsl_code () {                            // ********* FRAGMENT SHADER *********
      return this.shared_glsl_code () + `
    varying vec2 f_tex_coord;
    uniform sampler2D texture;
    uniform float animation_time;

    void main()  {        
        vec2 f_tex_2 = f_tex_coord;
        vec2 f_tex_3 = vec2(f_tex_2.s, f_tex_2.t - 0.02 * animation_time);


        // vec4 tex_color = texture2D( texture, f_tex_coord );       // Sample texture image in the correct place.
        vec4 tex_color = texture2D( texture, f_tex_3 );       // Sample texture image in the correct place.
        if( tex_color.w < .01 ) discard;
                        
        // This time, slightly disturb normals based on sampling the same image that was used for texturing.
        vec3 bumped_N  = N + tex_color.rgb - .5*vec3(1,1,1);
        gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
        gl_FragColor.xyz += phong_model_lights( normalize( bumped_N ), vertex_worldspace );
      
      
          //Blue for depth distance
          #define LOG2 1.442695
          float fogDensity = 0.009;
          float fogDistance = length(camera_center - vertex_worldspace);
          float fogAmount = 1. - exp2(-fogDensity * fogDensity * fogDistance * fogDistance * LOG2);
          fogAmount = clamp(fogAmount, 0., 1.);
          vec4 fog_color = vec4 (0.0, 0.41, 0.58, 1.0);
          // vec4 fog_color = vec4 (0.7, 0.7, 0.7, 1.0);
          gl_FragColor = mix(gl_FragColor, fog_color, fogAmount);
          // invert?
          // gl_FragColor = vec4(1.0 - gl_FragColor.rgb, gl_FragColor.a);
        } `;
  }
  update_GPU(context, gpu_addresses, uniforms, model_transform, material) {
    // update_GPU(): Add a little more to the base class's version of this method.
    super.update_GPU(context, gpu_addresses, uniforms, model_transform, material);
    // Updated for assignment 4
    context.uniform1f(gpu_addresses.animation_time, uniforms.animation_time / 1000);
  }
}




const FireShader = defs.FireShader = // with texture maps
class FireShader extends Shader {
  constructor (num_lights = 2) {
    super ();
    this.num_lights = num_lights;
}
shared_glsl_code () {          // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
    return ` 
  precision mediump float;
  const int N_LIGHTS = ` + this.num_lights + `;
  uniform float ambient, diffusivity, specularity, smoothness;
  uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
  uniform float light_attenuation_factors[N_LIGHTS];
  uniform vec4 shape_color;
  uniform vec3 squared_scale, camera_center;

  varying vec3 N, vertex_worldspace;
                                       // ***** PHONG SHADING HAPPENS HERE: *****
  vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ) {
      vec3 E = normalize( camera_center - vertex_worldspace );
      vec3 result = vec3( 0.0 );
      for(int i = 0; i < N_LIGHTS; i++) {
          vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz -
                                         light_positions_or_vectors[i].w * vertex_worldspace;
          float distance_to_light = length( surface_to_light_vector );

          vec3 L = normalize( surface_to_light_vector );
          vec3 H = normalize( L + E );
          
            // Compute diffuse and specular components of Phong Reflection Model.
          // float diffuse  =      max( dot( N, L ), 0.0 );
          float diffuse = max(dot(N, L), 0.0) * 1.0;
          // Fresnel-Schlick approximation for specular
          float fresnel_factor = 0.2; // Adjust this value to control the strength of the Fresnel effect
          float fresnel = fresnel_factor * pow(1.0 - max(dot(E, N), 0.0), 3.0);

          
          float specular = (1.0 - fresnel) * pow(max(dot(N, H), 0.0), smoothness) + fresnel;
          // float specular = pow( max( dot( N, H ), 0.0 ), smoothness );     // Use Blinn's "halfway vector" method.
          
          float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );

          vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                    + light_colors[i].xyz * specularity * specular;

          result += attenuation * light_contribution;
        }
      return result;
    } `;
}
vertex_glsl_code () {         // ********* VERTEX SHADER *********
  return this.shared_glsl_code () + `
varying vec2 f_tex_coord;
attribute vec3 position, normal;                            // Position is expressed in object coordinates.
attribute vec2 texture_coord;

uniform mat4 model_transform;
uniform mat4 projection_camera_model_transform;

void main() {
    gl_Position = projection_camera_model_transform * vec4( position, 1.0 );     // Move vertex to final space.
                                      // The final normal vector in screen space.
    N = normalize( mat3( model_transform ) * normal / squared_scale);

    vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                                      // Turn the per-vertex texture coordinate into an interpolated variable.
    f_tex_coord = texture_coord;
  } `;
}
fragment_glsl_code () {        // ********* FRAGMENT SHADER *********
return this.shared_glsl_code () + `
varying vec2 f_tex_coord;
uniform sampler2D texture;

void main() {
  vec4 tex_color = texture2D( texture, f_tex_coord );       // Sample texture image in the correct place.
  if( tex_color.w < .01 ) discard;
                                                           // Compute an initial (ambient) color:
  gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
                                                           // Compute the final color with contributions from lights:
  gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
} `;
}
static light_source (position, color, size) {
    return {position, color, attenuation: 1 / size};
}
send_material (gl, gpu, material) {
    gl.uniform4fv (gpu.shape_color, material.color);
    gl.uniform1f (gpu.ambient, material.ambient);
    gl.uniform1f (gpu.diffusivity, material.diffusivity);
    gl.uniform1f (gpu.specularity, material.specularity);
    gl.uniform1f (gpu.smoothness, material.smoothness);
}
send_uniforms (gl, gpu, uniforms, model_transform) {
    const O = vec4 (0, 0, 0, 1), camera_center = uniforms.camera_transform.times (O).to3 ();
    gl.uniform3fv (gpu.camera_center, camera_center);

    // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
    const squared_scale = model_transform.reduce (
      (acc, r) => { return acc.plus (vec4 (...r).times_pairwise (r)); }, vec4 (0, 0, 0, 0)).to3 ();
    gl.uniform3fv (gpu.squared_scale, squared_scale);

    // Send the current matrices to the shader as a single pre-computed final matrix, the product.
    const PCM = uniforms.projection_transform.times (uniforms.camera_inverse).times (model_transform);
    gl.uniformMatrix4fv (gpu.model_transform, false, Matrix.flatten_2D_to_1D (model_transform.transposed ()));
    gl.uniformMatrix4fv (gpu.projection_camera_model_transform, false,
                         Matrix.flatten_2D_to_1D (PCM.transposed ()));

    if ( !uniforms.lights || !uniforms.lights.length)
        return;         // Lights omitted, ambient only

    const light_positions_flattened = [], light_colors_flattened = [];
    for (var i = 0; i < 4 * uniforms.lights.length; i++) {
        light_positions_flattened.push (uniforms.lights[ Math.floor (i / 4) ].position[ i % 4 ]);
        light_colors_flattened.push (uniforms.lights[ Math.floor (i / 4) ].color[ i % 4 ]);
    }
    gl.uniform4fv (gpu.light_positions_or_vectors, light_positions_flattened);
    gl.uniform4fv (gpu.light_colors, light_colors_flattened);
    gl.uniform1fv (gpu.light_attenuation_factors, uniforms.lights.map (l => l.attenuation));
}
update_GPU (context, gpu_addresses, uniforms, model_transform, material) {
    const defaults    = {color: color (0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40, };
    let full_material = Object.assign (defaults, material);

    this.send_material (context, gpu_addresses, full_material);
    this.send_uniforms (context, gpu_addresses, uniforms, model_transform);

    if (material.texture && material.texture.ready) {
      // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
      context.uniform1i (gpu_addresses.texture, 0);
      // For this draw, use the texture image from correct the GPU buffer:
      material.texture.activate (context, 0);
  }
}
};