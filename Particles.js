import {tiny, defs} from './examples/common.js';

import { VectorField } from './VectorField.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

export class ParticleProducer {

    // Whole point of this class is to produce particles at a certain point.
    // ParticleProducer should pretty much always be at the Dragon's mouth.
    // As dragon moves, this position moves along with it producing fire particles.
    constructor(position) {
        this.position = position;
        this.field = new VectorField(position);
    }

    add_particles(mass, radius, velocity, fire_particles) {
        let particle = new Particle(mass, radius, this.position, velocity);
        fire_particles.push(particle);
    }

    cull_particles() {
        // Get rid of particles that move past a certain threshold.
    }
}

export class Particle {
    constructor(mass, radius, position, velocity){
        this.mass = mass;
        this.position = vec3(position[0], position[1], position[2]);
        this.velocity = velocity;
        this.net_force = vec3(0.0, 0.0, 0.0);

        this.radius = radius;
        this.particle_transform = Mat4.translation(this.position[0], this.position[1], this.position[2])
            .times(Mat4.scale(this.radius, this.radius, this.radius));
    }

    set_mass(mass) {
        this.mass = mass;
    }

    set_position(position) {
        this.position = position;
    }

    set_velocity(velocity) {
        this.velocity = velocity;
    }

    update_transform(){
        // if(this.radius < 3) {
        //     this.radius += 0.02;
        //     this.mass -= 0.02;
        // }
        this.particle_transform = Mat4.translation(this.position[0], this.position[1], this.position[2])
            .times(Mat4.scale(this.radius, this.radius, this.radius));
    }
}