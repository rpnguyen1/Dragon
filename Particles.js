import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

export class Particle {
    constructor(mass, position, velocity){
        this.mass = mass;
        this.position = position;
        this.velocity = velocity;
        this.net_force = vec3(0.0, 0.0, 0.0);

        this.radius = 0.25;
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
        this.particle_transform = Mat4.translation(this.position[0], this.position[1], this.position[2])
            .times(Mat4.scale(this.radius, this.radius, this.radius));
    }
}