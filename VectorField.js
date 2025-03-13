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
        this.field_cols = 10;

        // Where the + exponential part starts
        this.pexp_field = 0;
        // Where the straight field starts
        this.straight_field = 4;
        // Middle field line
        this.mid_field = 4;
        // Where the - exponential part starts
        this.nexp_field = 5;

        this.source_position = source_position;
        this.dir = dir;
        this.field = new Array(this.field_rows).fill(null).map(() => new Array(this.field_cols).fill(vec3(1, 0, 0)));

        this.x_width = 0.5;
        this.y_width = 0.5;
    }

    init() {
        // Modeling forces

        // Append funcs to be represented in the velocity field
        let funcs = [];
        // Making the functions for the top part of the field
        for(let i = this.straight_field - 1; i >= 0; i--) {
            let func = (x) => (0.2 * (2 ** i)) * Math.exp((0.2 * (2 ** i)) * x) * 2;
            funcs.push(func);
        }
        // Making the functions for the mid part of the field
        for(let i = this.straight_field; i < this.nexp_field; i++) {
            let func_1 = (x) => (0.1) * Math.exp((0.1) * x) * 2;
            let func_2 = (x) => -((0.1) * Math.exp((0.1) * x)) * 2;
            if(Math.random() < 0.5) funcs.push(func_1);
            else funcs.push(func_2);
        }
        // Making the functions for the bot part of the field
        for(let i = 0; i < this.straight_field; i++) {
            let func = (x) => -((0.2 * (2 ** i)) * Math.exp((0.2 * (2 ** i)) * x)) * 2;
            funcs.push(func);
        }

        for(let i = 0; i<this.field_rows; i++) {
            for(let j = 0; j<this.field_cols; j++) {
                this.field[i][j] = vec3(1, funcs[i](j * this.x_width), 0);
            }
        }

        // Used for rotating vector field around.
        let y_axis = vec3(0, 1, 0);
        let x_axis = vec3(1, 0, 0);
        console.log(this.dir)
        let vel_proj_xz = this.dir.minus(y_axis.times(this.dir.dot(y_axis)));
        console.log(vel_proj_xz)
        let perp = y_axis.cross(vel_proj_xz);
        console.log(perp)
        // How we get from VF dir to its Projection
        this.theta1 = this.get_angle_between_vectors(this.dir, vel_proj_xz);
        if (this.dir.cross(vel_proj_xz)[1] < 0) this.theta1 = -this.theta1;
        console.log(this.theta1 * 180 / Math.PI)
        // How we get from the x-axis to the projection
        this.theta2 = this.get_angle_between_vectors(x_axis, vel_proj_xz);
        if (x_axis.cross(vel_proj_xz)[1] < 0) this.theta2 = -this.theta2;
        console.log(this.theta2 * 180 / Math.PI)

        if(perp[1] < 0) perp = perp.times(-1);

        this.rot1 = Mat4.rotation(this.theta2, 0, 1, 0);
        this.rot2 = Mat4.rotation(-this.theta1, perp[0], perp[1], perp[2]);
        this.rot = this.rot2.times(this.rot1)

        this.rot1_to_x = Mat4.rotation(this.theta1, perp[0], perp[1], perp[2]);
        this.rot2_to_x = Mat4.rotation(-this.theta2, 0, 1, 0);
        this.rot_to_x = this.rot2_to_x.times(this.rot1_to_x)

        console.log(this.field)
    }

    get_vector_index(p) {
        // Index into the field with the location of the particle.
        let x = p.position[0] - this.source_position[0];
        let y = p.position[1] - this.source_position[1];
        let z = p.position[2] - this.source_position[2];

        let new_pos = this.rot_to_x.times(vec4(x, y, z, 1));

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

    // Spews fires farther out
    // More concentrated in middle.

    affect_particle(p) {
        let idxs = this.get_vector_index(p);
        if (idxs != -1) {
            let r = idxs[0];
            let c = idxs[1];

            let force = this.field[r][c];
            let new_force = this.rot.times(vec4(force[0], force[1], force[2], 1));

            p.net_force = new_force;

            // console.log("ROW: ", r, " COL: ", c);
            // console.log("POSITION: ", p.position);
            // console.log("NEW FORCE: ", force);
        }
    }

    get_angle_between_vectors(a, b) {
        return Math.acos(a.dot(b) / (a.norm() * b.norm()));
    }
}