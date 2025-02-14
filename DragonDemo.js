import {tiny, defs} from './examples/common.js';
import {Hermit_spline, Curve_Shape }from './hermit.js';
import {SpringMass }from './simulation.js';
import { Fabrik } from './fabrik.js'; // Forward And Backward Reaching Inverse Kinematics just for testing 


// Pull these names into this module's scope for convenience:
// const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;
const { vec3, vec4, color, Mat4, Shape, Shader, Texture, Component } = tiny;

// TODO: you should implement the required classes here or in another file.
const {Renderer, Entity, Camera, Light, Material} = defs

export
const DragonDemoBase = defs.DragonDemoBase =
    class DragonDemoBase extends Component
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


        // At the beginning of our program, load one of each of these shape
        // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
        // would be redundant to tell it again.  You should just re-use the
        // one called "box" more than once in display() to draw multiple cubes.
        // Don't define more than one blueprint for the same thing here.
        this.shapes = {
          'box'  : new defs.Cube(),
          'ball' : new defs.Subdivision_Sphere( 4 ),
          'axis' : new defs.Axis_Arrows(),
          'cylinder' : new defs.Shape_From_File("assets/dragon_body.obj"), // these dragon models are temporary!!!!!
          'head' : new defs.Shape_From_File("assets/dragon.obj"),
          'teapot' : new defs.Shape_From_File("assets/teapot.obj"),
        };

        // *** Materials: ***  A "material" used on individual shapes specifies all fields
        // that a Shader queries to light/color it properly.  Here we use a Phong shader.
        // We can now tweak the scalar coefficients from the Phong lighting formulas.
        // Expected values can be found listed in Phong_Shader::update_GPU().
        const basic = new defs.Basic_Shader();
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        const fake_bump = new defs.Fake_Bump_Map();


    

        this.materials = {};

        this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) }
        this.materials.metal   = { shader: phong, ambient: .2, diffusivity: 1, specularity:  1, color: color( .9,.5,.9,1 ) }
        this.materials.rgb = { shader: fake_bump, ambient: .5, texture: new Texture( "assets/rgb.jpg" ) }
        this.materials.dragon = { shader: fake_bump, ambient: .5, texture: new Texture( "assets/EDragon_Body.png" ) }
        this.materials.invisible = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( 0, 0, 0, 0 ) }

        this.ball_location = vec3(1, 1, 1);
        this.ball_radius = 0.25;

        // TODO: you should create a Spline class instance
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

        /************************************* Particle Spring dragon implementation ****************************************/



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
          if (i == 0) {
            this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.ball, this.materials.invisible, false);
            // this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.cylinder, this.materials.dragon);

          } else if (i == 1){
            this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.teapot, this.materials.rgb, false);
            // this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.cylinder, this.materials.dragon);

          } else{
            this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.teapot, this.materials.rgb, true);

          }
        }

        this.particleSystem.setGround(50000, 500000)
        this.particleSystem.setGravity(0)
        this.particleSystem.setDragCoefficient(0.99);
        this.particleSystem.setIntegrationMethod("verlet", 0.001);

        this.particleSystem.isRunning = true;
        this.particleSystem.t_sim = 0;


        /************************************* Fabrik dragon implementation ****************************************/
        // Suppose you want a chain starting at (0, 10, 0) with 10 segments:
        this.dragonTail = new Fabrik(vec3(0, 10, 0), 20, 3);
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
      }
    }


export class DragonDemo extends DragonDemoBase
{                                                    
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

    const blue = color( 0,0,1,1 ), yellow = color( 1,0.7,0,1 );

    const t = this.t = this.uniforms.animation_time/1000;

    // !!! Draw ground
    let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(100, 0.01, 100));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow } );



    // this code is to attach an object to the front of the camera
    let base_transform_r = Mat4.identity().times(Mat4.scale(0.2,0.2,0.2).times(Mat4.translation(2.5,-1.5,-100)));
    this.shapes.cylinder.draw(caller, this.uniforms, this.uniforms.camera_transform.times(base_transform_r), { ...this.materials.metal, color: yellow });
    let final_transform = this.uniforms.camera_transform.times(base_transform_r);
    let x = final_transform[0][3];
    let y = final_transform[1][3];
    let z = final_transform[2][3]; // could just use tovec3 to convert matrix to vector3
    

    // code for the delay startup (prevent wacky lag in the beginning destroying particles)
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

    point = this.spline.computePoint((t / 50) % 1); // Use the circular spline
    
    // this.particleSystem.setParticle(0, 1000, [x, y, z, 0, 0, 0]); // uncomment to make dragon follow camera
    this.particleSystem.setParticle(0, 10, [point[0], point[1], point[2], 0, 0, 0]); // Dragon follows spline
    this.particleSystem.draw(caller, this.uniforms, this.shapes, this.materials);
 
 
    // Fabrik Dragon test

    // Set a target for the tail's tip (e.g., this could be animated over time)
    this.dragonTail.setTarget(vec3(x, y, z)); // Follow camera
    // this.dragonTail.setTarget(vec3(point2[0], point2[1], point2[2]));
    this.dragonTail.update(10);  // Run several iterations to smooth out the IK solution
    // In your draw routine, render the chain:
    this.dragonTail.display(caller, this.uniforms, this.shapes, this.materials);
  }

  render_controls()
  {                                 
    // render_controls(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.
    this.control_panel.innerHTML += "Dragon!!!!!!!!!";
    this.new_line();    



    // TODO: You can add your button events for debugging. (optional)
  }
}
