import {tiny, defs} from './examples/common.js';
// import {Movement_Controls_2} from './FirstPersonController.js' 
import {Hermit_spline, Curve_Shape }from './hermit.js';
import {SpringMass }from './simulation.js';


// Pull these names into this module's scope for convenience:
// const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;
const { vec3, vec4, color, Mat4, Shape, Shader, Texture, Component } = tiny;

// TODO: you should implement the required classes here or in another file.
const {Renderer, Entity, Camera, Light, Material} = defs

export
const Assignment2_base = defs.Assignment2_base =
    class Assignment2_base extends Component
    {                                          
      // **My_Demo_Base** is a Scene that can be added to any display canvas.
      // This particular scene is broken up into two pieces for easier understanding.
      // The piece here is the base class, which sets up the machinery to draw a simple
      // scene demonstrating a few concepts.  A subclass of it, Assignment2,
      // exposes only the display() method, which actually places and draws the shapes,
      // isolating that code so it can be experimented with on its own.
      init()
      {
        console.log("init")

        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        this.hover = this.swarm = false;

        // Debug wall (for easier placement)
        //create_wall_x(xPos, zPos, length, height, material) {
          this._debug_xPos= 1;
          this._debug_zPos = 1;
          this._debug_length = 1;
          this._debug_height = 1;
          this._debug_material = 0;
          this._debug_orientation = 0;
          this._debug_precision = 1;
          this._debug = false;


        // At the beginning of our program, load one of each of these shape
        // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
        // would be redundant to tell it again.  You should just re-use the
        // one called "box" more than once in display() to draw multiple cubes.
        // Don't define more than one blueprint for the same thing here.
        this.shapes = {
          'box'  : new defs.Cube(),
          'ball' : new defs.Subdivision_Sphere( 4 ),
          'axis' : new defs.Axis_Arrows(),
          'cylinder' : new defs.Shape_From_File("assets/teapot.obj"),
        };

        // *** Materials: ***  A "material" used on individual shapes specifies all fields
        // that a Shader queries to light/color it properly.  Here we use a Phong shader.
        // We can now tweak the scalar coefficients from the Phong lighting formulas.
        // Expected values can be found listed in Phong_Shader::update_GPU().
        const basic = new defs.Basic_Shader();
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        const fake_bump = new defs.Fake_Bump_Map();

        // this.shader = new defs.Shadow_Instanced_Shader (Light.NUM_LIGHTS);
        // this.textured_shader = new defs.Shadow_Textured_Instanced_Shader (Light.NUM_LIGHTS);
    
        // this.materials = {
        //     food: new Material("Food", this.shader, { color: vec4(0.92, 0.22, 0.66, 1.0), diffuse: vec3(0.92, 0.22, 0.66), specular: vec3(1.0, 1.0, 1.0), smoothness: 32.0 }),
        //     sea_sky: new defs.Material_From_File("Sea_Sky", this.textured_shader, "models/textured_obj/sea_sky_textured/sea_sky.mtl")
        // }
        this.materials = {
          // sea_sky: new defs.Material_From_File("Sea_Sky", tex_phong, "assets/Leon_head.mtl"),
        };
        this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) }
        this.materials.metal   = { shader: phong, ambient: .2, diffusivity: 1, specularity:  1, color: color( .9,.5,.9,1 ) }
        this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture( "assets/rgb.jpg" ) }
        this.materials.leonALBD = { shader: fake_bump, ambient: .6, diffusivity: 0.5, specularity:  0.1, texture: new Texture( "assets/cha000_10_cm1_ALBD.png" ) }
        this.materials.leonHairALBD = { shader: fake_bump, ambient: .6, diffusivity: 0.5, specularity:  0.1, texture: new Texture( "assets/HAIRALBD.png" ) }

        this.ball_location = vec3(1, 1, 1);
        this.ball_radius = 0.25;

        // TODO: you should create a Spline class instance
        // this.sun_dir = vec4(0.0, 5.0, 7.0, 0.0);
        // this.sun = new Light({direction_or_position: this.sun_dir, color: vec3(0, 0, 0), diffuse: 0.6, specular: 0.1, attenuation_factor: 0.000001,
        //                       shadow_map_width: 1024, shadow_map_height: 1024, casts_shadow: true});
    
        // this.camera = new Camera(vec3(0.0, 0.0, 40.0));
    
        // this.renderer = new Renderer();
        // TODO: you should create the necessary shapes
        const controlPoints = [
          { x: -50, y: 10, z: 0 }, 
          { x: -50, y: 10, z: 50 }, 
          { x: 50, y: 4, z: 50 }, 
          { x: 50, y: 6, z: 0 },  
          { x: 0, y: 7, z: -50 },
          { x: -50, y: 10, z: 0 }, 
      ];
      
      const tangents = [
          { sx: -29, sy: 0, sz: 29 },
          { sx: 29, sy: 0, sz: 29 },  
          { sx: 29, sy: 0, sz: -29 }, 
          { sx: -29, sy: 0, sz: -29 }, 
          { sx: -29, sy: 0, sz: 29 },
          { sx: -29, sy: 0, sz: 29 },  
      ];


        this.spline = new Hermit_spline(controlPoints, tangents);
        this.curve_fn = (t) => this.spline.computePoint(t)
        this.sample_cnt = 1000;
        this.curve = new Curve_Shape(this.curve_fn, this.sample_cnt);
        const point = this.spline.computePoint(0.5);
        console.log(point); // { x: 0.5, y: 0.5, z: 0.5 }






        // Use a smaller spacing for a natural chain (e.g., 0.5 units)
        const numParticles = 20;
        const spacing = 0.05;         // Smaller spacing for a thick body
        const startY = 10;
        const startX = 0;

        // Set up the particle system
        this.particleSystem = new SpringMass();
        this.particleSystem.createParticle(numParticles);

        // Set particles in a curved formation: let's create a gentle arc
        for (let i = 0; i < numParticles; i++) {
          let mass = this.computeMass(i, numParticles);
          // Create a gentle curve: for example, an arc defined by a quadratic function.
          // You can tweak the curvature by adjusting the coefficient.
          let curvature = 0.2;
          let x = startX + i * spacing;
          let y = startY + curvature * (i - (numParticles - 1)/2) ** 2;
          let z = 0;  // or add a sinusoidal lateral component if desired

          this.particleSystem.setParticle(i, mass, [x, y, z, 0, 0, 0]);
        }

        // Create springs linking consecutive particles.
        this.particleSystem.createSprings(numParticles - 1);
        for (let i = 0; i < numParticles - 1; i++) {
          let { ks, kd } = this.computeSpringConstants(i, numParticles);
          this.particleSystem.link(i, i, i + 1, ks, kd, spacing);
        }

        this.particleSystem.setGround(50000, 500000)
        this.particleSystem.setGravity(0)
        this.particleSystem.setDragCoefficient(0.99);
        this.particleSystem.setIntegrationMethod("verlet", 0.001);

        this.particleSystem.isRunning = true;
        this.particleSystem.t_sim = 0;





      }

      // Mass distribution: Heavier in the middle, tapering at both ends.
      computeMass(i, numParticles) {
        // Using a quadratic curve centered on the middle of the chain.
        let mid = (numParticles - 1) / 2;
        let distance = Math.abs(i - mid);
        // Maximum mass at the center, lower at the ends.
        const maxMass = 100;
        const minMass = 7000;
        // Interpolate: when distance = 0 -> maxMass, when distance = mid -> minMass.
        return maxMass - (maxMass - minMass) * (distance / mid);
      }

      // Spring properties: Stiffer in the middle, softer at the tail.
      computeSpringConstants(i, numParticles) {
        // We'll vary based on the link index (0 to numParticles-2)
        const ksStart = 1000; // near head
        const ksMid = 900;   // stiffer midsection (for a solid body)
        const ksEnd = 500;   // softer tail
        const kdStart = 1000;
        const kdMid = 1000;
        const kdEnd = 500;
        
        let t;
        let ks, kd;
        if(i < numParticles / 2) {
          // Interpolate from head to midsection:
          t = i / (numParticles / 2);
          ks = ksStart * (1 - t) + ksMid * t;
          kd = kdStart * (1 - t) + kdMid * t;
        } else {
          // Interpolate from midsection to tail:
          t = (i - numParticles / 2) / (numParticles / 2);
          ks = ksMid * (1 - t) + ksEnd * t;
          kd = kdMid * (1 - t) + kdEnd * t;
        }
        return { ks, kd };
      }
      render_animation( caller )
      {                                                // display():  Called once per frame of animation.  We'll isolate out
        // the code that actually draws things into Assignment2, a
        // subclass of this Scene.  Here, the base class's display only does
        // some initial setup.

        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if( !caller.controls )
        { this.animated_children.push( caller.controls = new defs.Movement_Controls( { uniforms: this.uniforms } ) );
        // { this.animated_children.push( caller.controls = new defs.Movement_Controls_2( { uniforms: this.uniforms } ) );
          caller.controls.add_mouse_controls( caller.canvas );

          // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
          // matrix follows the usual format for transforms, but with opposite values (cameras exist as
          // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
          // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
          // orthographic() automatically generate valid matrices for one.  The input arguments of
          // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

          // !!! Camera changed here
          // TODO: you can change the camera as needed.
          Shader.assign_camera( Mat4.look_at (vec3 (5, 8, 15), vec3 (0, 5, 0), vec3 (0, 1, 0)), this.uniforms );
        }
        this.uniforms.projection_transform = Mat4.perspective( Math.PI/4, caller.width/caller.height, 1, 100 );

        // *** Lights: *** Values of vector or point lights.  They'll be consulted by
        // the shader when coloring shapes.  See Light's class definition for inputs.
        const t = this.t = this.uniforms.animation_time/1000;

        // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
        // !!! Light changed here
        const light_position = vec4(20, 20, 20, 1.0);
        this.uniforms.lights = [ defs.Phong_Shader.light_source( light_position, color( 1,1,1,1 ), 1000000 ) ];

        // draw axis arrows.
        // Debug
        if (this._debug){
          let _debug_transform = Mat4.translation(this._debug_xPos, this._debug_height/2, this._debug_zPos).times(Mat4.scale(this._debug_length/2, this._debug_height/2, 0.25));
          if (this._debug_orientation % 3 == 0) {
              _debug_transform = Mat4.translation(this._debug_xPos, this._debug_height/2, this._debug_zPos).times(Mat4.scale(0.25, this._debug_height/2, this._debug_length/2));
          }
          if (this._debug_orientation % 3 == 1) {
              _debug_transform = Mat4.translation(this._debug_xPos, 0, this._debug_zPos).times(Mat4.scale(this._debug_height/2, 1, this._debug_length/2));
          }
          // this.shapes.cube.draw(context, program_state, _debug_transform, shadow_pass? this.pic2 : this.pure);
          this.shapes.ball.draw( caller, this.uniforms, _debug_transform, this.materials.plastic);
  
          console.log("x: " + this._debug_xPos + "  z:  " + this._debug_zPos + "  length:  " + this._debug_length + "  height:  " + this._debug_height + "  mat:  " + this._debug_material + "  precision:  " + this._debug_precision);
          console.log("room0.create_wall_z("+this._debug_xPos+","+ this._debug_zPos+"," +this._debug_length+","+ this._debug_height+", this.Wall); " );
          
        }

      }
    }


export class Assignment2 extends Assignment2_base
{                                                    
  // **Assignment2** is a Scene object that can be added to any display canvas.
  // This particular scene is broken up into two pieces for easier understanding.
  // See the other piece, My_Demo_Base, if you need to see the setup code.
  // The piece here exposes only the display() method, which actually places and draws
  // the shapes.  We isolate that code so it can be experimented with on its own.
  // This gives you a very small code sandbox for editing a simple scene, and for
  // experimenting with matrix transformations.
  render_animation( caller )
  {                                                // display():  Called once per frame of animation.  For each shape that you want to
    // appear onscreen, place a .draw() call for it inside.  Each time, pass in a
    // different matrix value to control where the shape appears.

    // Variables that are in scope for you to use:
    // this.shapes.box:   A vertex array object defining a 2x2x2 cube.
    // this.shapes.ball:  A vertex array object defining a 2x2x2 spherical surface.
    // this.materials.metal:    Selects a shader and draws with a shiny surface.
    // this.materials.plastic:  Selects a shader and draws a more matte surface.
    // this.lights:  A pre-made collection of Light objects.
    // this.hover:  A boolean variable that changes when the user presses a button.
    // shared_uniforms:  Information the shader needs for drawing.  Pass to draw().
    // caller:  Wraps the WebGL rendering context shown onscreen.  Pass to draw().

    // Call the setup code that we left inside the base class:
    super.render_animation( caller );

    /**********************************
     Start coding down here!!!!
     **********************************/
    // From here on down it's just some example shapes drawn for you -- freely
    // replace them with your own!  Notice the usage of the Mat4 functions
    // translation(), scale(), and rotation() to generate matrices, and the
    // function times(), which generates products of matrices.

    const blue = color( 0,0,1,1 ), yellow = color( 1,0.7,0,1 ), 
          wall_color = color( 0.7, 1.0, 0.8, 1 ), 
          blackboard_color = color( 0.2, 0.2, 0.2, 1 );

    const t = this.t = this.uniforms.animation_time/1000;

    // !!! Draw ground
    let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(10, 0.01, 10));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow } );

    // TODO: you should draw scene here.
    // TODO: you can change the wall and board as needed.
    let wall_transform = Mat4.translation(0, 5, -1.2).times(Mat4.scale(6, 5, 0.1));
    this.shapes.box.draw( caller, this.uniforms, wall_transform, { ...this.materials.plastic, color: wall_color } );
    let board_transform = Mat4.translation(3, 6, -1).times(Mat4.scale(2.5, 2.5, 0.1));
    this.shapes.box.draw( caller, this.uniforms, board_transform, { ...this.materials.plastic, color: blackboard_color } );
    
    
    let torso = Mat4.translation(0, 0, 0).times(Mat4.scale(1, 1, 1));
    this.shapes.ball.draw( caller, this.uniforms, torso, { ...this.materials.plastic, color: blackboard_color } );



    // let point = this.spline.computePoint(Math.abs(Math.sin(t/10)));
    let base_transform_r = Mat4.identity().times(Mat4.scale(0.2,0.2,0.2).times(Mat4.translation(2.5,-1.5,-50)));
    this.shapes.cylinder.draw(caller, this.uniforms, this.uniforms.camera_transform.times(base_transform_r), { ...this.materials.metal, color: yellow });
    
    let final_transform = this.uniforms.camera_transform.times(base_transform_r);

    // Extract translation components (assuming final_transform is a 4x4 matrix)
    let x = final_transform[0][3];
    let y = final_transform[1][3];
    let z = final_transform[2][3];
    
    // console.log("Cylinder Position:", x, y, z);
    // this.ball_location = point;
    let point;
    let delay = 1;
    if (t < delay) {
        point = [0, 10, 0]; // Stay still for the first 5 seconds
    } else {
        let adjustedT = t - delay; // Start motion from t = 0 after 5 seconds
        point = [-adjustedT, 10 * Math.sin(adjustedT) + 10, 0];
    }


    let ball_transform2 = Mat4.translation(point[0], point[1], point[2])
    .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));
    this.shapes.ball.draw( caller, this.uniforms, ball_transform2, { ...this.materials.metal, color: blue } );
    
    this.curve.draw(caller, this.uniforms);

    point = this.spline.computePoint((t / 50) % 1);

    // this.particleSystem.setParticle(0, 1000, [x, y, z, 0, 0, 0]);
    this.particleSystem.setParticle(0, 10, [point[0], point[1], point[2], 0, 0, 0]);
    this.particleSystem.draw(caller, this.uniforms, this.shapes, this.materials);
  }

  render_controls()
  {                                 
    // render_controls(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.
    this.control_panel.innerHTML += "Assignment 2: IK Engine";
    this.new_line();    
    // TODO: You can add your button events for debugging. (optional)
    this.key_triggered_button( "Debug", [ "Shift", "D" ], null );
    this.new_line();

    this.key_triggered_button("Toggle Debug Box", ["Shift", "G"],
      () => this._debug = !this._debug);
  this.new_line();
  this.key_triggered_button("-_debug_zPos", ["Shift", "W"],
      () => this._debug_zPos -= this._debug_precision);
  this.key_triggered_button("+_debug_zPos",   ["Shift", "S"],
      () => this._debug_zPos += this._debug_precision);
      this.new_line();
  this.key_triggered_button("-_debug_xPos",   ["Shift", "A"],
      () => this._debug_xPos -= this._debug_precision);
  this.key_triggered_button("+_debug_xPos",  ["Shift", "D"],
      () => this._debug_xPos += this._debug_precision);
      this.new_line();
      this.new_line();
  this.key_triggered_button("-_debug_length",  ["r"],
      () => this._debug_length -= this._debug_precision);
  this.key_triggered_button("+_debug_length",  ["q"],
      () => this._debug_length += this._debug_precision);
      this.new_line();
  this.key_triggered_button("-_debug_height",  ["Shift","R"],
      () => this._debug_height -= this._debug_precision);
  this.key_triggered_button("+_debug_height",  ["Shift","Q"],
      () => this._debug_height += this._debug_precision);
      this.new_line();
      this.new_line();
  this.key_triggered_button("-_debug_precision",  ["Shift","J"],
      () => this._debug_precision *= 2);
  this.key_triggered_button("+_debug_precision",  ["Shift","K"],
      () => this._debug_precision /= 2);
      this.new_line();
  this.key_triggered_button("-_debug_orientation",  ["Shift","O"],
      () => this._debug_orientation += 1);
      this.new_line();
  }
}
