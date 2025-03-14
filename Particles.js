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
    }

    add_particles(mass, radius, velocity, fire_particles, t) {
        let random_y = Math.random() * 6 - 3;
        let particle = new Particle(mass, radius, this.position, velocity, t);
        console.log(particle.creation_t)
        // if (fire_particles.length < 500)
        fire_particles.push(particle);
    }
}

export class Particle {
    constructor(mass, radius, position, velocity, t){
        this.mass = mass;
        this.position = vec3(position[0], position[1], position[2]);
        this.velocity = velocity;
        this.net_force = vec3(0.0, 0.0, 0.0);

        this.radius = radius;
        this.particle_transform = Mat4.translation(this.position[0], this.position[1], this.position[2])
            .times(Mat4.scale(this.radius, this.radius, this.radius));

        this.creation_t = t;
        this.color = color(1, 0, 0, 1)
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

    enlarge() {
        if(this.radius < 2) {
            this.radius += 0.005;
            this.mass -= 0.001;
        }
    }

    update_transform(){
        this.enlarge()
        this.particle_transform = Mat4.translation(this.position[0], this.position[1], this.position[2])
            .times(Mat4.scale(this.radius, this.radius, this.radius));
    }

    get_angle_between_vectors(a, b) {
        return Math.acos(a.dot(b) / (a.norm() * b.norm()));
    }
}