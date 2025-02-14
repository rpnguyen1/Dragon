import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

// TODO: you should implement the required classes here or in another file.

export
const Part_two_spring_base = defs.Part_two_spring_base =
    class Part_two_spring_base extends Component
    {                                          // **My_Demo_Base** is a Scene that can be added to any display canvas.
                                               // This particular scene is broken up into two pieces for easier understanding.
                                               // The piece here is the base class, which sets up the machinery to draw a simple
                                               // scene demonstrating a few concepts.  A subclass of it, Part_one_hermite,
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
        this.shapes = { 'box'  : new defs.Cube(),
          'ball' : new defs.Subdivision_Sphere( 4 ),
          'axis' : new defs.Axis_Arrows() };

        // *** Materials: ***  A "material" used on individual shapes specifies all fields
        // that a Shader queries to light/color it properly.  Here we use a Phong shader.
        // We can now tweak the scalar coefficients from the Phong lighting formulas.
        // Expected values can be found listed in Phong_Shader::update_GPU().
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        this.materials = {};
        this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) }
        this.materials.metal   = { shader: phong, ambient: .2, diffusivity: 1, specularity:  1, color: color( .9,.5,.9,1 ) }
        this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture( "assets/rgb.jpg" ) }

        this.ball_location = vec3(1, 1, 1);
        this.ball_radius = 0.25;

        // TODO: you should create the necessary shapes
          this.particleSystem = new SpringMass();
          this.particleSystem.isRunning = false;
          this.particleSystem.t_sim = 0;


      }

      render_animation( caller )
      {                                                // display():  Called once per frame of animation.  We'll isolate out
        // the code that actually draws things into Part_one_hermite, a
        // subclass of this Scene.  Here, the base class's display only does
        // some initial setup.

        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if( !caller.controls )
        { this.animated_children.push( caller.controls = new defs.Movement_Controls( { uniforms: this.uniforms } ) );
          caller.controls.add_mouse_controls( caller.canvas );

          // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
          // matrix follows the usual format for transforms, but with opposite values (cameras exist as
          // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
          // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
          // orthographic() automatically generate valid matrices for one.  The input arguments of
          // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

          // !!! Camera changed here
          Shader.assign_camera( Mat4.look_at (vec3 (10, 10, 10), vec3 (0, 0, 0), vec3 (0, 1, 0)), this.uniforms );
        }
        this.uniforms.projection_transform = Mat4.perspective( Math.PI/4, caller.width/caller.height, 1, 100 );

        // *** Lights: *** Values of vector or point lights.  They'll be consulted by
        // the shader when coloring shapes.  See Light's class definition for inputs.
        const t = this.t = this.uniforms.animation_time/1000;
        const angle = Math.sin( t );

        // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
        // !!! Light changed here
        const light_position = vec4(20 * Math.cos(angle), 20,  20 * Math.sin(angle), 1.0);
        this.uniforms.lights = [ defs.Phong_Shader.light_source( light_position, color( 1,1,1,1 ), 1000000 ) ];

        // draw axis arrows.
        // this.shapes.axis.draw(caller, this.uniforms, Mat4.identity(), this.materials.rgb);
      }
    }


// Spring class 
class Particle{
  constructor(mass, position, velocity, force, model, material){
    this.mass = mass;
    this.position = position;
    this.velocity = velocity;
    this.force = force;
    this.previousPosition = null;
    this.model = model;
    this.material = material;
  }
  update(mass, position, velocity, force, model, material){
    this.mass = mass;
    this.position = position;
    this.velocity = velocity;
    this.force = force;
    this.model = model;
    this.material = material
  }
}

class Spring{
  constructor(particle_i, particle_j, ks, kd, l, force, model, material, doScale){
    this.pi = particle_i;
    this.pj = particle_j;
    this.ks = ks;
    this.kd = kd;
    this.l = l;
    this.veForce = force;
    this.model = model;
    this.material = material;
    this.doScale = doScale;
  }

  update(particle_i, particle_j, ks, kd, l, model, material, doScale){
    this.pi = particle_i;
    this.pj = particle_j;
    this.ks = ks;
    this.kd = kd;
    this.l = l;
    this.model = model;
    this.material = material;
    this.doScale = doScale;
  }

}

export class SpringMass {
  constructor(){
    this.particles = [];  // Store particles
    this.springs = [];    // Store springs
    this.gravity = -9.8; // Default gravity 
    // this.gravity = [0, -9.8, 0]; // Default gravity 
    this.ground = { ks: 5000, kd: 1 };  // Ground spring properties
    this.method = "euler";
    this.timestep = 0.001;
    this.isRunning = false;
    this.groundPos = [0,0,0];
    this.groundNormal = [0,1,0];
    this.t_sim = 0;

    this.groundLevel = 0.1;
    this.restitution = 0.8;     // Coefficient of restitution (0 = no bounce, 1 = perfectly elastic)
    this.frictionCoeff = 0.5;   // Friction coefficient applied as an impulse
    this.dragCoefficient = 0.8; 
  }

  setGroundLevel(value) {
    this.groundLevel = value;
  }
  
  setRestitution(value) {
    this.restitution = Math.max(0, Math.min(1, value)); // Clamp between 0 and 1
  }
  
  setFrictionCoeff(value) {
    this.frictionCoeff = Math.max(0, value); // Ensure it's non-negative
  }
  
  setDragCoefficient(value) {
    this.dragCoefficient = Math.max(0, value); // Ensure it's non-negative
  }
  

// create particles <Number of Particles>
  createParticle(num){
    for (let i = 0; i < num; i++) {
      this.particles.push(
        // create a default particle?
        new Particle(1, [0, 0, 0], [0, 0, 0], [0, 0, 0], null, null)
        // mass: 1,  // default mass
        // position: [0, 0, 0], // default position
        // velocity: [0, 0, 0], // default velocity
      );
    }
  }

// particle <index> <mass> <x y z vx vy vz>
  setParticle(id, mass, transform, model, material){
    if (this.particles[id]) {
      this.particles[id].mass = mass;
      this.particles[id].position = transform.slice(0, 3); // Position
      this.particles[id].velocity = transform.slice(3, 6); // Velocity
      this.model = model;
      this.material = material;
    } else {
      console.log("Invalid particle index");
    }
  }
// all_velocities <vx vy vz>
  setAllVelocities(v){
    this.particles.forEach(particle => {
      particle.velocity = v;
    });
  }

  // create springs <Number of Springs>
  createSprings(num){
    for (let i = 0; i < num; i++) {
      console.log("creating spring", i)
      this.springs.push(
        // pid1: -1,
        // pid2: -1,
        // ks: 1,    // Spring constant
        // kd: 0.1,  // Damping constant
        // length: 1 // Rest length
        new Spring(-1, -1, 1, 0, 1, 1, [0, 0, 0], null, null)
      );
    }
  }

  //link <sindex> <pindex1> <pindex2> <ks> <kd> <length>
  link(sid, pid1, pid2, ks, kd, length, model, material, doScale){
    if (this.springs[sid]) {
      this.springs[sid].update(pid1,pid2,ks,kd,length, model, material, doScale);
      // this.springs[sid] = {
      //   pid1,
      //   pid2,
      //   ks,
      //   kd,
      //   length
      // };
    } else {
      console.log("Invalid spring index");
    }
  }

  // //integration <"euler" | "symplectic" | "verlet"> <timestep>
  // update(t_step){ // Inner physics update loop
  //   // console.log("updateing particles");


  //   /////////////////////////////////////// Apply forces  //////////////////////////

  //   this.particles.forEach(particle => {
  //     particle.force = [0, this.gravity * particle.mass, 0]; // Gravity force
  //     // console.log(particle.velocity)

  //   });

  //   // update springs
  //   this.springs.forEach((spring, index) => {
  //     if (spring.pi === -1 || spring.pj === -1) return; // Ignore invalid links
      
  //     let pA = this.particles[spring.pi];
  //     let pB = this.particles[spring.pj];
  
  //     // Compute displacement vector and current length
  //     let delta = [
  //       pB.position[0] - pA.position[0],
  //       pB.position[1] - pA.position[1],
  //       pB.position[2] - pA.position[2]
  //     ];
  //     let length = Math.sqrt(delta[0] ** 2 + delta[1] ** 2 + delta[2] ** 2);
  //     if (length === 0) return; // Avoid division by zero
  //     let direction = delta.map(d => d / length); // ????
      

  //     //calc the spring force
  //     let springForceMagnitude = -spring.ks * (length - spring.l);
      
  //     let relativeVelocity = [
  //       pB.velocity[0] - pA.velocity[0],
  //       pB.velocity[1] - pA.velocity[1],
  //       pB.velocity[2] - pA.velocity[2]
  //     ];

  //     //calc the damper force (viscous)
  //     let velocityDot = relativeVelocity[0] * direction[0] +
  //     relativeVelocity[1] * direction[1] +
  //     relativeVelocity[2] * direction[2];
  //     let dampingForceMagnitude = -spring.kd * velocityDot;

  //     let force = direction.map(d => d * (springForceMagnitude + dampingForceMagnitude));
  //     for (let i = 0; i < 3; i++) {
  //       pA.force[i] -= force[i];  // Force on pA
  //       pB.force[i] += force[i];  // Equal and opposite force on pB
  //     }
  //   })

  //   // Update positions and velocities
  //   switch (this.method) {
  //     case "euler":
  //       this.eulerIntegration(t_step);
  //       break;
  //     case "symplectic":
  //       this.symplecticIntegration(t_step);
  //       break;
  //     case "verlet":
  //       this.verletIntegration(t_step);
  //       break;
  //     default:
  //       console.log("Invalid integration method");
  //   }

  //   // Detect ground collision and do collision resolution
  //   this.particles.forEach(particle => {
  //     if (particle.position[1] < 0.1) {  // size of particle
  //         // particle.position[1] = 0;

  //         // touching ground
  //         let pA = particle;
  //         // let pB = this.particles[spring.pj];
      
  //         // Compute displacement vector and current length
  //         let length = Math.abs(particle.position[1]);
  //         let delta = [
  //           0,
  //           length,
  //           0
  //         ];
  //         // let direction = delta.map(d => d / length); // ????
  //         let direction = this.groundNormal;
    
  //         //calc the spring force
  //         let springForceMagnitude = -this.ground.ks * length;
          
  //         let relativeVelocity = [
  //           0 - pA.velocity[0],
  //           0 - pA.velocity[1],
  //           0 - pA.velocity[2]
  //         ];
    
  
  //         //calc the damper force (viscous)
    
  //         let velocityDot = relativeVelocity[0] * direction[0] +
  //         relativeVelocity[1] * direction[1] +
  //         relativeVelocity[2] * direction[2];
  //         let dampingForceMagnitude = -this.ground.kd * velocityDot;
  
  //         let force = direction.map(d => d * (springForceMagnitude + dampingForceMagnitude));
  //         let frictionCoeff = 0.5; // Adjust for more/less friction
  //         let friction = [
  //             -frictionCoeff * pA.velocity[0],
  //             0, // No friction in vertical direction
  //             -frictionCoeff * pA.velocity[2]
  //         ];

  //         // Apply friction force
  //         pA.force[0] += friction[0];
  //         pA.force[2] += friction[2];

  //         // let force = direction.map(d => d * (springForceMagnitude));
  //         pA.force[1] -= force[1];  // Force on pA // only aply force on one axis?

  //         // for (let i = 0; i < 3; i++) {
  
  //         // particle.velocity[i] += (particle.force[i] * t_step) / particle.mass;
  //         pA.velocity[1] += (pA.force[1] * t_step) / pA.mass;
  //         pA.velocity[0] += (pA.force[0] * t_step) / pA.mass;
  //         pA.velocity[2] += (pA.force[2] * t_step) / pA.mass;
  
  //         // }
  //       }
  //   });
  // }
// // Integration <"euler" | "symplectic" | "verlet"> <timestep>
// update(t_step) {  
//   /////////////////////////////////////// Apply forces  //////////////////////////
//   this.particles.forEach(particle => {
//       particle.force = [0, this.gravity * particle.mass, 0]; // Apply gravity
//   });

//   // Update springs
//   this.springs.forEach(spring => {
//       if (spring.pi === -1 || spring.pj === -1) return; // Ignore invalid links
      
//       let pA = this.particles[spring.pi];
//       let pB = this.particles[spring.pj];

//       // Compute displacement vector and current length
//       let delta = [
//           pB.position[0] - pA.position[0],
//           pB.position[1] - pA.position[1],
//           pB.position[2] - pA.position[2]
//       ];
//       let length = Math.hypot(...delta); 
//       if (length === 0) return; // Avoid division by zero
//       let direction = delta.map(d => d / length);  

//       // Spring force
//       let springForceMagnitude = -spring.ks * (length - spring.l);
      
//       // Velocity damping (damper force)
//       let relativeVelocity = [
//           pB.velocity[0] - pA.velocity[0],
//           pB.velocity[1] - pA.velocity[1],
//           pB.velocity[2] - pA.velocity[2]
//       ];
//       let velocityDot = relativeVelocity.reduce((sum, v, i) => sum + v * direction[i], 0);
//       let dampingForceMagnitude = -spring.kd * velocityDot;

//       // Apply forces
//       let force = direction.map(d => d * (springForceMagnitude + dampingForceMagnitude));
//       for (let i = 0; i < 3; i++) {
//           pA.force[i] -= force[i];  // Force on pA
//           pB.force[i] += force[i];  // Equal and opposite force on pB
//       }
//   });

//   // Integrate particle positions and velocities
//   switch (this.method) {
//       case "euler":
//           this.eulerIntegration(t_step);
//           break;
//       case "symplectic":
//           this.symplecticIntegration(t_step);
//           break;
//       case "verlet":
//           this.verletIntegration(t_step);
//           break;
//       default:
//           console.error("Invalid integration method");
//   }

//   // Detect and resolve ground collision
//   this.resolveGroundCollisions(t_step);
// }

// update(t_step) {
//   const groundLevel = 0.1;
//   const restitution = 0.8;     // Coefficient of restitution (0 = no bounce, 1 = perfectly elastic)
//   const frictionCoeff = 0.5;   // Friction coefficient applied as an impulse

//   // 1. Reset forces (apply gravity)
//   this.particles.forEach(particle => {
//     particle.force = [0, this.gravity * particle.mass, 0];
//   });

//   // 2. Accumulate spring forces
//   this.springs.forEach(spring => {
//     if (spring.pi === -1 || spring.pj === -1) return;
    
//     let pA = this.particles[spring.pi];
//     let pB = this.particles[spring.pj];

//     // Compute displacement vector and its length
//     let delta = [
//       pB.position[0] - pA.position[0],
//       pB.position[1] - pA.position[1],
//       pB.position[2] - pA.position[2]
//     ];
//     let length = Math.hypot(...delta);
//     if (length === 0) return;
//     let direction = delta.map(d => d / length);

//     // Spring force magnitude (Hooke's law)
//     let springForceMag = -spring.ks * (length - spring.l);
    
//     // Damping force magnitude (projected relative velocity)
//     let relativeVelocity = [
//       pB.velocity[0] - pA.velocity[0],
//       pB.velocity[1] - pA.velocity[1],
//       pB.velocity[2] - pA.velocity[2]
//     ];
//     let velDot = relativeVelocity.reduce((sum, v, i) => sum + v * direction[i], 0);
//     let dampingForceMag = -spring.kd * velDot;

//     let force = direction.map(d => d * (springForceMag + dampingForceMag));
//     for (let i = 0; i < 3; i++) {
//       pA.force[i] -= force[i];
//       pB.force[i] += force[i];
//     }
//   });

//   // 3. Save the old acceleration for each particle
//   this.particles.forEach(particle => {
//     particle.acceleration_old = particle.force.map(f => f / particle.mass);
//   });

//   // 4. Update positions using Velocity Verlet formula:
//   //    new_position = position + velocity * t + 0.5 * a_old * t^2
//   this.particles.forEach(particle => {
//     for (let i = 0; i < 3; i++) {
//       particle.position[i] += particle.velocity[i] * t_step + 0.5 * particle.acceleration_old[i] * t_step * t_step;
//     }
//     // If the particle penetrates the ground, correct its position.
//     if (particle.position[1] < groundLevel) {
//       particle.position[1] = groundLevel;
//     }
//   });

//   // 5. Recalculate forces at the new positions.
//   //    (Reset forces to gravity and reapply spring forces)
//   this.particles.forEach(particle => {
//     particle.force = [0, this.gravity * particle.mass, 0];
//   });
//   this.springs.forEach(spring => {
//     if (spring.pi === -1 || spring.pj === -1) return;
    
//     let pA = this.particles[spring.pi];
//     let pB = this.particles[spring.pj];

//     let delta = [
//       pB.position[0] - pA.position[0],
//       pB.position[1] - pA.position[1],
//       pB.position[2] - pA.position[2]
//     ];
//     let length = Math.hypot(...delta);
//     if (length === 0) return;
//     let direction = delta.map(d => d / length);

//     let springForceMag = -spring.ks * (length - spring.l);
//     let relativeVelocity = [
//       pB.velocity[0] - pA.velocity[0],
//       pB.velocity[1] - pA.velocity[1],
//       pB.velocity[2] - pA.velocity[2]
//     ];
//     let velDot = relativeVelocity.reduce((sum, v, i) => sum + v * direction[i], 0);
//     let dampingForceMag = -spring.kd * velDot;
    
//     let force = direction.map(d => d * (springForceMag + dampingForceMag));
//     for (let i = 0; i < 3; i++) {
//       pA.force[i] -= force[i];
//       pB.force[i] += force[i];
//     }
//   });

//   // 6. Update velocities using the average of old and new accelerations.
//   this.particles.forEach(particle => {
//     let acceleration_new = particle.force.map(f => f / particle.mass);
//     for (let i = 0; i < 3; i++) {
//       particle.velocity[i] += 0.5 * (particle.acceleration_old[i] + acceleration_new[i]) * t_step;
//     }
    
//     // 7. Collision impulse: if at ground and moving downward, reflect vertical velocity.
//     if (particle.position[1] === groundLevel && particle.velocity[1] < 0) {
//       particle.velocity[1] = -restitution * particle.velocity[1];
//       // Apply friction to horizontal velocities:
//       particle.velocity[0] *= (1 - frictionCoeff * t_step);
//       particle.velocity[2] *= (1 - frictionCoeff * t_step);
//     }
//   });
// }

update(t_step) {
  this.groundLevel = 0.1;
  this.restitution = 0.8;     // Coefficient of restitution (0 = no bounce, 1 = perfectly elastic)
  this.frictionCoeff = 0.5;   // Friction coefficient applied as an impulse
  this.dragCoefficient = 0.8; // Adjust this value for stronger or weaker air drag

  // 1. Reset forces (apply gravity)
  this.particles.forEach(particle => {
    particle.force = [0, this.gravity * particle.mass, 0];
  });

  // 2. Accumulate spring forces
  this.springs.forEach(spring => {
    if (spring.pi === -1 || spring.pj === -1) return;
    
    let pA = this.particles[spring.pi];
    let pB = this.particles[spring.pj];

    // Compute displacement vector and its length
    let delta = [
      pB.position[0] - pA.position[0],
      pB.position[1] - pA.position[1],
      pB.position[2] - pA.position[2]
    ];
    let length = Math.hypot(...delta);
    if (length === 0) return;
    let direction = delta.map(d => d / length);

    // Spring force magnitude (Hooke's law)
    let springForceMag = -spring.ks * (length - spring.l);
    
    // Damping force magnitude (projected relative velocity)
    let relativeVelocity = [
      pB.velocity[0] - pA.velocity[0],
      pB.velocity[1] - pA.velocity[1],
      pB.velocity[2] - pA.velocity[2]
    ];
    let velDot = relativeVelocity.reduce((sum, v, i) => sum + v * direction[i], 0);
    let dampingForceMag = -spring.kd * velDot;

    let force = direction.map(d => d * (springForceMag + dampingForceMag));
    for (let i = 0; i < 3; i++) {
      pA.force[i] -= force[i];
      pB.force[i] += force[i];
    }
  });

  // 2.5. Apply air drag forces to each particle
  this.particles.forEach(particle => {
    for (let i = 0; i < 3; i++) {
      // Air drag: force proportional to velocity (acts opposite to direction of motion)
      particle.force[i] += -this.dragCoefficient * particle.velocity[i];
    }
  });

  // 3. Save the old acceleration for each particle
  this.particles.forEach(particle => {
    particle.acceleration_old = particle.force.map(f => f / particle.mass);
  });

  // 4. Update positions using Velocity Verlet formula:
  //    new_position = position + velocity * t + 0.5 * a_old * t^2
  this.particles.forEach(particle => {
    for (let i = 0; i < 3; i++) {
      particle.position[i] += particle.velocity[i] * t_step + 0.5 * particle.acceleration_old[i] * t_step * t_step;
    }
    // If the particle penetrates the ground, correct its position.
    if (particle.position[1] < this.groundLevel) {
      particle.position[1] = this.groundLevel;
    }
  });

  // 5. Recalculate forces at the new positions.
  //    (Reset forces to gravity and reapply spring forces)
  this.particles.forEach(particle => {
    particle.force = [0, this.gravity * particle.mass, 0];
  });
  this.springs.forEach(spring => {
    if (spring.pi === -1 || spring.pj === -1) return;
    
    let pA = this.particles[spring.pi];
    let pB = this.particles[spring.pj];

    let delta = [
      pB.position[0] - pA.position[0],
      pB.position[1] - pA.position[1],
      pB.position[2] - pA.position[2]
    ];
    let length = Math.hypot(...delta);
    if (length === 0) return;
    let direction = delta.map(d => d / length);

    let springForceMag = -spring.ks * (length - spring.l);
    let relativeVelocity = [
      pB.velocity[0] - pA.velocity[0],
      pB.velocity[1] - pA.velocity[1],
      pB.velocity[2] - pA.velocity[2]
    ];
    let velDot = relativeVelocity.reduce((sum, v, i) => sum + v * direction[i], 0);
    let dampingForceMag = -spring.kd * velDot;
    
    let force = direction.map(d => d * (springForceMag + dampingForceMag));
    for (let i = 0; i < 3; i++) {
      pA.force[i] -= force[i];
      pB.force[i] += force[i];
    }
  });

  // 6. Update velocities using the average of old and new accelerations.
  this.particles.forEach(particle => {
    let acceleration_new = particle.force.map(f => f / particle.mass);
    for (let i = 0; i < 3; i++) {
      particle.velocity[i] += 0.5 * (particle.acceleration_old[i] + acceleration_new[i]) * t_step;
    }
    
    // 7. Collision impulse: if at ground and moving downward, reflect vertical velocity.
    if (particle.position[1] === this.groundLevel && particle.velocity[1] < 0) {
      particle.velocity[1] = -this.restitution * particle.velocity[1];
      // Apply friction to horizontal velocities:
      particle.velocity[0] *= (1 - this.frictionCoeff * t_step);
      particle.velocity[2] *= (1 - this.frictionCoeff * t_step);
    }
  });
}


resolveGroundCollisions(t_step) {
  const groundLevel = 0.1;
  const restitution = 1; // Coefficient of restitution (0 = no bounce, 1 = perfect bounce)
  const frictionCoeff = 0.5;

  this.particles.forEach(particle => {
      if (particle.position[1] < groundLevel) {  // Particle below ground
          let penetrationDepth = groundLevel - particle.position[1];
          let normal = [0, 1, 0]; // Upward normal

          // Apply spring force (ground reaction)
          let groundSpringForce = -this.ground.ks * penetrationDepth;

          // Compute damping force (reduce velocity but allow bouncing)
          let velocityDot = particle.velocity[1] * normal[1];
          let groundDampingForce = -this.ground.kd * velocityDot * 0.5; // Reduce damping to allow bounce

          // Total normal force
          let groundReactionForce = groundSpringForce + groundDampingForce;
          particle.force[1] += groundReactionForce;

          // Apply friction (opposes horizontal motion)
          let friction = [
              -frictionCoeff * particle.velocity[0],
              0, 
              -frictionCoeff * particle.velocity[2]
          ];
          particle.force[0] += friction[0];
          particle.force[2] += friction[2];

          // Correct position
          particle.position[1] = groundLevel;

          // Reflect velocity for bounce, applying restitution
          if (particle.velocity[1] < 0) {
              particle.velocity[1] *= -restitution; // Bounce with energy loss
          }
      }
      console.log("particle pos:  " ,particle.position[1] , particle.velocity[1]);

  });

}


  setIntegrationMethod(method, timestep) {
    this.method = method;
    this.timestep = timestep;
  }

  eulerIntegration(timestep) {
    this.particles.forEach((particle, index) => {
      // Update position based on velocity
      for (let i = 0; i < 3; i++) {
        particle.position[i] += particle.velocity[i] * timestep;
      }
  
      for (let i = 0; i < 3; i++) {
        particle.velocity[i] += (particle.force[i] * timestep) / particle.mass;
      }
    });
  }
  

  symplecticIntegration(timestep) {
    this.particles.forEach((particle, index) => {
      // Update velocity
      for (let i = 0; i < 3; i++) {
        particle.velocity[i] += (particle.force[i] * timestep) / particle.mass;
      }

      // Then update position based on the updated velocity
      for (let i = 0; i < 3; i++) {
          particle.position[i] += particle.velocity[i] * timestep;
      }
    });
  }

  verletIntegration(timestep) {
    this.particles.forEach(particle => {
      if (!particle.previousPosition) {
        // Initialize previous position for the first step
        particle.previousPosition = [...particle.position];
      }

      // Calculate new position using Verlet formula
      let newPosition = [];
      for (let i = 0; i < 3; i++) {
        newPosition[i] = 2 * particle.position[i] - particle.previousPosition[i] +
                         (particle.force[i] / particle.mass) * timestep * timestep;
      }

      // Estimate velocity based on position difference
      let newVelocity = [];
      for (let i = 0; i < 3; i++) {
        newVelocity[i] = (newPosition[i] - particle.previousPosition[i]) / (2 * timestep);
      }

      // Update previous position before changing the current position
      particle.previousPosition = [...particle.position];
      particle.position = newPosition;
      particle.velocity = newVelocity;
    });
  
  }

  //ground <ks> <kd>
  setGround(ks, kd){
    this.ground.ks = ks;
    this.ground.kd = kd;  
  }

  //gravity <g>
  setGravity(g){
    // this.gravity[1] = -1 * g; 
    this.gravity = -1 * g;  
  }

  draw(caller, uniforms, shapes, materials) {


    if (this.isRunning == true){
      let dt = 1 / 60; // usually 1/60 s
      dt = Math.min(1/60, dt);
      // t_step = 1/1000; // or even smaller
      let t_step = this.timestep;
      let t_next = this.t_sim + dt; // t_sim is the simulation time
      for ( ; this.t_sim <= t_next; this.t_sim += t_step ) {
        this.update(t_step) // conduct simulation
      }
    }


    const blue = color( 0,0,1,1 ), white = color( 1,1,1,1 );
    // Draw particles
    for (let particle of this.particles) {
      const post = particle.position; 
      const pos = vec3(post[0],post[1],post[2]); 
      let model_transform = Mat4.scale(0.2, 0.2, 0.2);
      model_transform.pre_multiply(Mat4.translation(pos[0], pos[1], pos[2]));
      // let transform = Mat4.translation(...particle.position)
      //   .times(Mat4.scale(0.1, 0.1, 0.1)); // Adjust size if needed
      if (particle.model == null) {
        shapes.ball.draw(caller, uniforms, model_transform, { ...materials.metal, color: blue });        
      } else{
        particle.model.draw(caller, uniforms, model_transform, particle.material);        
      }

    }

    // Draw springs
    for (let spring of this.springs) {
      if (spring.pi !== -1 && spring.pj !== -1) {
        let p1t = this.particles[spring.pi].position;
        let p2t = this.particles[spring.pj].position;
        let p1 = vec3(p1t[0], p1t[1], p1t[2]);
        let p2 = vec3(p2t[0], p2t[1], p2t[2]);
        

        const len = (p2.minus(p1)).norm();
        const center = (p1.plus(p2).times(0.5));

        // let model_transform = Mat4.scale(0.5, len / 2, 0.5);
        let model_transform;
        if (spring.doScale) {
          model_transform = Mat4.scale(1, len / 2, 1);
        } else{
          model_transform = Mat4.scale(1, 1, 1);
        }

        const p = p1.minus(p2).normalized();
        let v = vec3(0, 1, 0);
        if(Math.abs(v.cross(p).norm()) < 0.1){
          v = vec3(0, 0, 1);
          model_transform = Mat4.scale(0.05, 0.05, len / 2);
        }
        const w = v.cross(p).normalized();

        const theta = Math.acos(v.dot(p));
        model_transform.pre_multiply(Mat4.rotation(theta, w[0], w[1], w[2]));
        model_transform.pre_multiply(Mat4.translation(center[0], center[1], center[2]));

        if (spring.model == null) {
          shapes.cylinder.draw(caller, uniforms, model_transform, { ...materials.metal, color: white });
        } else{
          spring.model.draw(caller, uniforms, model_transform, spring.material);

        }
      }
    }


  }


}


export class Part_two_spring extends Part_two_spring_base
{                                                    // **Part_one_hermite** is a Scene object that can be added to any display canvas.
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

    const blue = color( 0,0,1,1 ), yellow = color( 1,1,0,1 );

    const t = this.t = this.uniforms.animation_time/1000;

    // !!! Draw ground
    let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(10, 0.01, 10));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow } );

    // !!! Draw ball (for reference)
    // let ball_transform = Mat4.translation(this.ball_location[0], this.ball_location[1], this.ball_location[2])
    //     .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));
    // this.shapes.ball.draw( caller, this.uniforms, ball_transform, { ...this.materials.metal, color: blue } );

    // TODO: you should draw spline here.
    // let dt = this.dt = Math.min(1/30, this.uniforms.animation_delta_time / 1000);
    // dt *= this.sim_speed;
    this.particleSystem.draw(caller, this.uniforms, this.shapes, this.materials);
    // if (this.particleSystem.isRunning == true){
    //   this.particleSystem.update();
    // }

  }

  render_controls()
  {                                 // render_controls(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.
    this.control_panel.innerHTML += "Part Two:";
    this.new_line();
    this.key_triggered_button( "Config", [], this.parse_commands );
    this.new_line();
    this.key_triggered_button( "Run", [], this.start );
    this.new_line();

    /* Some code for your reference
    this.key_triggered_button( "Copy input", [ "c" ], function() {
      let text = document.getElementById("input").value;
      console.log(text);
      document.getElementById("output").value = text;
    } );
    this.new_line();
    this.key_triggered_button( "Relocate", [ "r" ], function() {
      let text = document.getElementById("input").value;
      const words = text.split(' ');
      if (words.length >= 3) {
        const x = parseFloat(words[0]);
        const y = parseFloat(words[1]);
        const z = parseFloat(words[2]);
        this.ball_location = vec3(x, y, z)
        document.getElementById("output").value = "success";
      }
      else {
        document.getElementById("output").value = "invalid input";
      }
    } );
     */
  }

  parse_commands() {
    let input_text = document.getElementById("input").value;
    let text = input_text.trim();
    let output_text = "";
    console.log(text);
    const commands = text.split("\n"); // split multiple commands
  
    commands.forEach((command) => {
      command = command.trim();
      
      if (command.startsWith("create particles")) {
        const match = command.match(/^create particles\s*([\d.\-]+)$/);
        if (match) {
          const num = parseFloat(match[1]);
          output_text += `Created ${num} particle(s)\n`;
          this.particleSystem.createParticle(num);
        } else {
          output_text += "Invalid 'create particles' command.\n";
        }
      } else if (command.startsWith("particle")) {
        const match = command.match(/^particle\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)$/);
        if (match) {
          const index = parseFloat(match[1]);
          const mass = parseFloat(match[2]);
          const x = parseFloat(match[3]);
          const y = parseFloat(match[4]);
          const z = parseFloat(match[5]);
          const vx = parseFloat(match[6]);
          const vy = parseFloat(match[7]);
          const vz = parseFloat(match[8]);
          output_text += `Particle setup: index ${index}, mass ${mass}, position (${x}, ${y}, ${z}), velocity (${vx}, ${vy}, ${vz})\n`;
          
          this.particleSystem.setParticle(index, mass, [x, y, z, vx, vy, vz]);
        } else {
          output_text += "Invalid 'particle' command.\n";
        }
      } else if (command.startsWith("all_velocities")) {
        const match = command.match(/^all_velocities\s*([\d.\-]+)\s*([\d.\-]+)\s*([\d.\-]+)$/);
        if (match) {
          const vx = parseFloat(match[1]);
          const vy = parseFloat(match[2]);
          const vz = parseFloat(match[3]);
          output_text += `Set all velocities to (${vx}, ${vy}, ${vz})\n`;
          this.particleSystem.setAllVelocities([vx, vy, vz]);
        } else {
          output_text += "Invalid 'all_velocities' command.\n";
        }
      } else if (command.startsWith("create springs")) {
        const match = command.match(/^create springs\s*([\d.\-]+)$/);
        if (match) {
          const num = parseFloat(match[1]);
          output_text += `Created ${num} spring(s)\n`;
          this.particleSystem.createSprings(num);
        } else {
          output_text += "Invalid 'create springs' command.\n";
        }
      } else if (command.startsWith("link")) {
        const match = command.match(/^link\s*([\d.\-]+)\s*([\d.\-]+)\s*([\d.\-]+)\s*([\d.\-]+)\s*([\d.\-]+)\s*([\d.\-]+)$/);
        if (match) {
          const sindex = parseFloat(match[1]);
          const pindex1 = parseFloat(match[2]);
          const pindex2 = parseFloat(match[3]);
          const ks = parseFloat(match[4]);
          const kd = parseFloat(match[5]);
          const length = parseFloat(match[6]);
          output_text += `Link setup: spring ${sindex}, particles ${pindex1}, ${pindex2}, ks ${ks}, kd ${kd}, length ${length}\n`;
          this.particleSystem.link(sindex, pindex1, pindex2, ks, kd, length);
        } else {
          output_text += "Invalid 'link' command.\n";
        }
      } else if (command.startsWith("integration")) {
        const match = command.match(/^integration\s*(euler|sympletic|verlet)\s*(\d+(\.\d+)?)$/);
        if (match) {
          const method = match[1];
          const timestep = parseFloat(match[2]);
          output_text += `Integration method: ${method}, Timestep: ${timestep}\n`;
          this.particleSystem.setIntegrationMethod(method, timestep);
        } else {
          output_text += "Invalid 'integration' command.\n";
        }
      } else if (command.startsWith("ground")) {
        const match = command.match(/^ground\s*([\d.\-]+)\s*([\d.\-]+)$/);
        if (match) {
          const ks = parseFloat(match[1]);
          const kd = parseFloat(match[2]);
          output_text += `Ground setup: ks ${ks}, kd ${kd}\n`;
          this.particleSystem.setGround(ks, kd);
        } else {
          output_text += "Invalid 'ground' command.\n";
        }
      } else if (command.startsWith("gravity")) {
        const match = command.match(/^gravity\s*([\d.\-]+)$/);
        if (match) {
          const g = parseFloat(match[1]);
          output_text += `Gravity set to ${g}\n`;
          this.particleSystem.setGravity(g);
        } else {
          output_text += "Invalid 'gravity' command.\n";
        }
      } else {
        output_text += `Unknown command: ${command}\n`;
      }
    });
  

    document.getElementById("output").value = output_text;
  }
  

  start() { // callback for Run button
    document.getElementById("output").value = "start";
    //TODO
    this.particleSystem.isRunning = true;
    
  }
}