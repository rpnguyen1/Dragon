// Dragon Classes and Simulation - A system for simulating different types of dragons with various behaviors
// Im not sure what is the best way to simulate a dragon so here i could just try out different methods and find the best


// This file defines several dragon types that extend the base Dragon class, including:
// - SpringMassDragon: A dragon using a spring-mass system for realistic particle-based body movement
// - FabrikDragon: A dragon using forward and backward reaching inverse kinematics for its tail movement

// The dragons use a set of shapes and materials that can be passed into each class
// The simulation incorporates behaviors like flying, breathing fire, and moving in response to physics

// Additional utilities include:
// - Particle systems for the SpringMassDragon and FabrikDragon to simulate realistic movement
// - IK (Inverse Kinematics) for manipulating the tail of the FabrikDragon

// Imported modules:
// - "common.js" for shared functionality (e.g., shapes, materials, shaders)
// - "hermit.js" for curve and spline functionality
// - "simulation.js" for the SpringMass simulation
// - "fabrik.js" for inverse kinematics implementation


import {tiny, defs} from './examples/common.js';
import {Hermit_spline, Curve_Shape }from './hermit.js';
import {SpringMass }from './simulation.js';
import { Fabrik } from './fabrik.js'; // Forward And Backward Reaching Inverse Kinematics just for testing 
import { ParticleProducer } from './Particles.js';


// Pull these names into this module's scope for convenience:
// const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;
const { vec3, vec4, color, Mat4, Shape, Shader, Texture, Component } = tiny;

const {Renderer, Entity, Camera, Light, Material} = defs


// Base class for all dragons
export class Dragon {
    constructor(shapes, materials) { // pass in all the shapes/materials we will use
        this.shapes = shapes;
        this.materials = materials;
    }

    // Default behavior (can be overridden)
    breatheFire(fire_particles) {
        console.log(`${this.name} breathes fire!`);
    }

    // Shared method for all dragons
    fly() {
        console.log(`${this.name} is flying through the sky.`);
    }

    get_head_position() {
        console.log("Getting head position!");
    }
}

// SpringMassDragon - Extends the base Dragon classs
export class SpringMassDragon extends Dragon {
    constructor(shapes, materials) {
        super(shapes, materials);
        this.init();
    }

    init(){
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
            // this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.body, this.materials.dragon);

          } else if (i == 1){
            // this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.teapot, this.materials.rgb, false);
            this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.head, this.materials.gold, false);

          } else{
            // this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.teapot, this.materials.rgb, true);
            this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.body, this.materials.gold, true);

          }
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

    draw(caller, uniforms, point) {
        this.particleSystem.setParticle(0, 10, [point[0], point[1], point[2], 0, 0, 0]); // Dragon follows spline
        this.particleSystem.draw(caller, uniforms, this.shapes, this.materials);
    }

    breatheFire() {
        console.log(`breathes a massive fireball! `);
    }
}

// Fabrik Dragon - Another implementation
export class FabrikDragon extends Dragon {
    constructor(shapes, materials) {
        super(shapes, materials);
        this.init();
    }
    init(){
        this.dragonTail = new Fabrik(vec3(0, 10, 0), 20, 3);
        let head_dir = this.get_head_direction().normalized();
        this.mouth = new ParticleProducer(this.get_head_position().plus(head_dir));


        this.fireball = new SpringMass();
        this.objectPoolSize = 20;
        this.fireball.createParticle(this.objectPoolSize);
        for (let i = 0; i < this.objectPoolSize; i++ ){
            this.fireball.setParticle(i, 10, [0, 10, 10, 0, 0, 0], this.shapes.square, this.materials.explosion, 10.0, true, false);

        }
        this.objectPoolIndex = 0;


        this.shooting = false;
        this.shootTimer = 0;
        this.shootInterval = 0.05; // Delay between particles (in seconds)
        this.shootCounter = 0;
        this.previousHeadPosition = null; // Initialize previous head position


        // this.fireball.createSprings(5);
        // this.fireball.link(0, 0, 1, 1000, 2000, 1, this.shapes.leg, this.materials.dragon, true, 22);
        // this.fireball.link(1, 0, 1, 1000, 2000, 1, this.shapes.ball, this.materials.dragon, true, 10);
        // this.fireball.link(1, 0, 1, 100, 200, 1, this.shapes.leg, this.materials.dragon, true);
        // this.fireball.link(2, 0, 1, 100, 200, 1, this.shapes.leg, this.materials.dragon, true);
        // this.fireball.link(3, 0, 1, 100, 200, 1, this.shapes.leg, this.materials.dragon, true);
        // this.fireball.link(4, 0, 1, 100, 200, 1, this.shapes.leg, this.materials.dragon, true);

        // this.fireball.setGround(50000, 500000)
        this.fireball.setGround(50, 50)
        this.fireball.setGravity(9.8)
        this.fireball.setDragCoefficient(0.99);
        this.fireball.setFrictionCoeff(0.99);
        this.fireball.setIntegrationMethod("verlet", 0.001);

        this.fireball.isRunning = false;
        // this.fireball.isRunning = true;
        this.fireball.t_sim = 0;
    }
    draw(caller, uniforms, target){
        // Set a target for the tail's tip (e.g., this could be animated over time)
        this.dragonTail.setTarget(target); // Follow camera
        // this.dragonTail.setTarget(vec3(point2[0], point2[1], point2[2]));
        this.dragonTail.update(1);  // Run several iterations to smooth out the IK solution
        // Update dragon mouth
        this.mouth.position = this.get_head_position();

        // this.fireball.setParticle(0, 10, [this.mouth.position[0], this.mouth.position[1]+5, this.mouth.position[2],
        //                                         0,0,0], 
        //     this.shapes.leg, this.materials.dragon);
        // this.fireball.setParticle(1, 10, [this.fireball.particles[1].position[0], 
        //         this.fireball.particles[1].position[1], 
        //         this.fireball.particles[1].position[2],
        //         this.fireball.particles[1].velocity[0] / 2 ,
        //         this.fireball.particles[1].velocity[1] / 2 ,
        //         this.fireball.particles[1].velocity[2] / 2], 
        //         this.shapes.leg, this.materials.dragon);
        this.fireball.draw(caller, uniforms, this.shapes, this.materials);
        // In your draw routine, render the chain:
        this.dragonTail.display(caller, uniforms, this.shapes, this.materials);
        
        let currentHeadPosition = this.get_head_position();
        let headVelocity = [0, 0, 0];

        if (this.previousHeadPosition) {
            let deltaTime = uniforms.animation_delta_time / 1000; // Convert to seconds

            if (deltaTime > 0) {
                headVelocity = [
                    (currentHeadPosition[0] - this.previousHeadPosition[0]) / deltaTime,
                    (currentHeadPosition[1] - this.previousHeadPosition[1]) / deltaTime,
                    (currentHeadPosition[2] - this.previousHeadPosition[2]) / deltaTime,
                ];
            }
        }

        this.previousHeadPosition = currentHeadPosition; // Update for next frame

        if (this.shooting) {
            this.shootTimer += uniforms.animation_delta_time / 1000;

            if (this.shootTimer >= this.shootInterval) {
                this.shootParticle(headVelocity); // Pass headVelocity
                this.shootTimer = 0;
                this.shootCounter++;

                if (this.shootCounter >= 20) {
                    this.shooting = false;
                    this.shootCounter = 0;
                }
            }
        }

    }
    shoot() {
        this.mouth.position = this.get_head_position();
        this.shooting = true;
        this.shootTimer = 0;
        this.shootCounter = 0;
        this.fireball.isRunning = true;
    }

    shootParticle(headVelocity) {
        let v = this.get_head_direction();
        let y_angle = Math.PI / 9 * (Math.random() * 0.5 - 0.25);
        let x_angle = Math.PI / 9 * (Math.random() * 0.5 - 0.25);
        let mag = Math.random() * (30 - 20) + 20;

        let rot_y = Mat4.rotation(y_angle, 0, 1, 0);
        let rot_x = Mat4.rotation(x_angle, 1, 0, 0);
        let rot = rot_x.times(rot_y);
        let new_v = rot.times(v);
        new_v = new_v.normalized().times(mag);

        // Add dragon's head velocity to the particle's velocity
        let particleVelocity = [
            new_v[0] + headVelocity[0],
            new_v[1] + headVelocity[1],
            new_v[2] + headVelocity[2]
        ];

        this.fireball.setParticle(this.objectPoolIndex, 10, [this.mouth.position[0], this.mouth.position[1], this.mouth.position[2],
            particleVelocity[0],
            particleVelocity[1],
            particleVelocity[2]],
            this.shapes.square, this.materials.explosion, Math.random() * 2 + 2 , true, true);

        this.objectPoolIndex = (this.objectPoolIndex + 1) % (this.objectPoolSize-1);
    }

    breatheFire(fire_particles) {
        console.log(` breathes an fiery blast!`);
        let v = this.get_head_direction();
        
        for(let i = 0; i<10; i++) {
            // We're gonna spit fire in a cone shape. The mouth is the pointy end.
            let y_angle = Math.PI / 9 * (Math.random() * 2 - 1); // Rotate about y
            let x_angle = Math.PI / 9 * (Math.random() * 2 - 1); // Rotate about x

            // Randomize how fast we shoot particle
            let mag = Math.random() * (30 - 20) + 20;

            let rot_y = Mat4.rotation(y_angle, 0, 1, 0);
            let rot_x = Mat4.rotation(x_angle, 1, 0, 0);
            let rot = rot_x.times(rot_y);
            let new_v = rot.times(v);

            this.mouth.add_particles(0.1, 0.1, new_v.normalized().times(mag), fire_particles);

            
        }
    }
    get_head_position() {
        return this.dragonTail.segments[this.dragonTail.numSegments - 1].position;
    }
    get_head_direction() {
        return this.dragonTail.segments[this.dragonTail.numSegments - 1].position.minus(
            this.dragonTail.segments[this.dragonTail.numSegments - 2].position
        )
    }
}

// Electric Dragon - Easily add more implementations
export class ElectricDragon extends Dragon {
    constructor(name) {
        super();
    }

    breatheFire() {
        console.log(`shoots a lightning bolt!`);
    }
}

// // Factory function to create dragons
// export function createDragon(type) {
//     const dragonTypes = {
//         spring: SpringMassDragon,
//         ice: IceDragon,
//         electric: ElectricDragon,
//     };
//     return new (dragonTypes[type] || Dragon);
// }

// // Usage
// const dragon1 = createDragon("fire", "Smaug");
// const dragon2 = createDragon("ice", "Frostfang");
// const dragon3 = createDragon("electric", "Voltazar");

// dragon1.breatheFire(); // Smaug breathes a massive fireball!
// dragon2.breatheFire(); // Frostfang breathes an icy blast
// dragon3.breatheFire(); // Voltazar shoots a lightning bolt!
// dragon1.fly();         //  is flying through the sky.
