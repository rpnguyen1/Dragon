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
    breatheFire() {
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
            this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.head, this.materials.dragon, false);

          } else{
            // this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.teapot, this.materials.rgb, true);
            this.particleSystem.link(i, i, i + 1, ks, kd, spacing, this.shapes.body, this.materials.dragon, true);

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
    }
    draw(caller, uniforms, target){
        // Set a target for the tail's tip (e.g., this could be animated over time)
        this.dragonTail.setTarget(target); // Follow camera
        // this.dragonTail.setTarget(vec3(point2[0], point2[1], point2[2]));
        this.dragonTail.update(10);  // Run several iterations to smooth out the IK solution
        // In your draw routine, render the chain:
        this.dragonTail.display(caller, uniforms, this.shapes, this.materials);
    }
    breatheFire() {
        console.log(` breathes an fiery blast!`);
    }
    get_head_position() {
        return this.dragonTail.segments[this.dragonTail.numSegments - 1];
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
