import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

// As fire blows, it gets bigger, less dense.
// Middle section is darker, outside are more opaque
    // The farther it is away from the sides, the more opaque.
// As fire stops, the trailing smoke should be get more opaque.

export class VectorField {
    constructor(source_position, dir) {
        this.field_rows = 9;
        this.mid_field = 4;
        this.field_cols = 20

        this.source_position = source_position;
        this.dir = dir;
        this.field = new Array(this.field_rows).fill(null).map(() => new Array(this.field_cols).fill(vec3(1, 0, 0)));

        this.x_width = 0.5;
        this.y_width = 0.5;
    }

    init() {
        // Modeling forces
        let func1 = (x) => 0.2 * Math.exp(0.2 * x);
        let func2 = (x) => 0.4 * Math.exp(0.2 * x);
        let func3 = (x) => 0.8 * Math.exp(0.2 * x);

        // Top three gradual exponential
        for(let i = 0; i<this.field_cols; i++) {
            this.field[0][i] = vec3(1, func3(i), 0);
            this.field[1][i] = vec3(1, func2(i), 0);
            this.field[2][i] = vec3(1, func1(i), 0);
        }

        // Middle two, continue forward
        // Already vec3(0, 0, 0);

        // Bottom three gradual negative exponential
        for(let i = 0; i<this.field_cols; i++) {
            this.field[6][i] = vec3(1, -func1(i * this.x_width), 0);
            this.field[7][i] = vec3(1, -func2(i * this.x_width), 0);
            this.field[8][i] = vec3(1, -func3(i * this.x_width), 0);
        }

        for(let i = 0; i<this.field_rows; i++) {
            for(let j = 0; j<this.field_cols; j++) this.field[i][j] = this.field[i][j].times(5);
        }

        let y_axis = vec3(0, 1, 0);
        let vel_proj_xz = this.dir.minus(y_axis.times(this.dir.dot(y_axis)));
        let perp = y_axis.cross(vel_proj_xz);
        this.theta1 = -this.get_angle_between_vectors(this.dir, vel_proj_xz);
        this.theta2 = -this.get_angle_between_vectors(vec3(1, 0, 0), vel_proj_xz);

        if(perp[1] < 0) perp = perp.times(-1);

        this.rot1 = Mat4.rotation(this.theta2, 0, 1, 0);
        this.rot2 = Mat4.rotation(this.theta1, perp[0], perp[1], perp[2]);
        this.rot = this.rot2.times(this.rot1)

        console.log(this.field)
    }

    get_vector_index(p) {
        // Index into the field with the location of the particle.
        let x = p.position[0] - this.source_position[0];
        let y = p.position[1] - this.source_position[1];
        let z = p.position[2] - this.source_position[2];

        let rot = Mat4.rotation(-this.theta2, 0, 1, 0);
        let new_pos = rot.times(vec4(x, y, z, 1));

        // console.log("ROTATED POS: ", new_pos)

        let x_idx = Math.floor(new_pos[0] / this.x_width);
        if(new_pos[0] < 0) x_idx = Math.ceil((new_pos[0] / this.x_width));
        let y_idx = this.mid_field - Math.floor(new_pos[1] / this.y_width);
        if(new_pos[1] < 0) y_idx = this.mid_field - Math.ceil((new_pos[1] / this.x_width));

        // console.log("ROTATED POS: ", new_pos)
        // console.log(x_idx, y_idx)

        if(x_idx >= this.field_cols || x_idx < 0) return -1;
        else if(y_idx >= this.field_rows || y_idx < 0) return -1;
        else{
            return [y_idx, x_idx];
        }
    }

    affect_particle(p) {
        let idxs = this.get_vector_index(p);
        if (idxs != -1) {
            let r = idxs[0];
            let c = idxs[1];

            let vel = this.field[r][c];
            let new_vel = this.rot.times(vec4(vel[0], vel[1], vel[2], 1));

            p.velocity = new_vel

            console.log("ROW: ", r, " COL: ", c);
            console.log("POSITION: ", p.position);
            console.log("NEW VELOCITY: ", vel);
        }
    }

    get_angle_between_vectors(a, b) {
        return Math.acos(a.dot(b) / (a.norm() * b.norm()));
    }
}