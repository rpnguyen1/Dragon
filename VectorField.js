import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

// As fire blows, it gets bigger, less dense.
// Middle section is darker, outside are more opaque
    // The farther it is away from the sides, the more opaque.
// As fire stops, the trailing smoke should be get more opaque.

export class VectorField {
    constructor(source_position) {
        this.field_rows = 9;
        this.mid_field = 4;
        this.field_cols = 20

        this.source_position = source_position;
        this.field = new Array(this.field_rows).fill(null).map(() => new Array(this.field_cols).fill(vec3(1, 1, 0)));

        this.x_width = 0.5;
        this.y_width = 0.5;

        this.init();
    }

    init() {
        // Modeling forces
        let func1 = (x) => 0.2 * Math.exp(0.2 * x);
        let func2 = (x) => 0.4 * Math.exp(0.2 * x);
        let func3 = (x) => 0.8 * Math.exp(0.2 * x);

        // Top three gradual exponential
        for(let i = 0; i<20; i++) {
            this.field[0][i] = vec3(1, func3(i), 0);
            this.field[1][i] = vec3(1, func2(i), 0);
            this.field[2][i] = vec3(1, func1(i), 0);
        }

        // Middle two, continue forward
        // Already vec3(0, 0, 0);

        // Bottom three gradual negative exponential
        for(let i = 0; i<20; i++) {
            this.field[6][i] = vec3(1, -func1(i * this.x_width), 0);
            this.field[7][i] = vec3(1, -func2(i * this.x_width), 0);
            this.field[8][i] = vec3(1, -func3(i * this.x_width), 0);
        }
    }

    get_vector_index(p) {
        // Index into the field with the location of the particle.
        let x = p.position[0] - this.source_position[0];
        let y = p.position[1] - this.source_position[1];

        let x_idx = x / this.x_width;
        let y_idx = this.mid_field - y / this.y_width;

        if(x_idx >= this.field_cols || x_idx < 0) return -1;
        else if(y_idx >= this.field_rows || y_idx < 0) return -1;
        else{
            return [y_idx, x_idx];
        }
    }

    affect_particle(p) {
        let p_vel = p.velocity;
        let x_axis = vec3(1, 0, 0);
        let perp = x_axis.cross(p_vel);
        let angle = Math.acos(p_vel.dot(x_axis) / p_vel.norm());

        if(perp[1] < 0) perp = perp.times(-1);

        // Rotation matrix to get x-axis to the direction that 
        // our head is pointing at.
        let rot = Mat4.rotation(-angle, perp[0], perp[1], perp[2]);

        let idxs = this.get_vector_index(p);
        if (idxs != -1) {
            let r = idxs[0];
            let c = idxs[1];

            let vel = this.field[r][c];
            let new_vel = rot.times(vec4(vel[0], vel[1], vel[2], 1));
            p.velocity = new_vel;

            console.log(new_vel)
        }
    }
}