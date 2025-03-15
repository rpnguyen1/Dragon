import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

import { Particle } from './Particles.js';
import  { Spring } from './Spring.js';

// Each particle is held together by a spring.
// For each spring, it holds two particles.

// Box is made up a bunch of particles. 

export class ThermoBox {
    constructor(temp) {
        // 3 Layers, with 3 rows x 3 cols
        this.layers = 10;
        this.n = 10;
        this.m = 10;

        this.k = 1.17; // Thermal diffusivity of copper
        this.spec_heat = 0.385; // Specific heat of copper
        this.mass_density = 8960;
        this.init_temp = temp;

        this.start_position = vec3(4, 4, 4)
        this.spacing = 7/this.layers // Length of the spring
        this.prev_t = 0;
        this.d_t = 0.01 * this.spacing * this.spacing / this.k;

        this.particles = [];
        this.springs = [];
        this.topology = [];
        this.U = new Array(this.layers).fill(null).map(
            () => new Array(this.n).fill(null).map(
                () => new Array(this.m).fill(0)
            ) 
        );

        this.go_time = false;
        this.hit_counter = 0;

        for(let l = 0; l<this.layers; l++) {
            for(let i = 0; i<this.n; i++) {
                for(let j = 0; j<this.m; j++) {
                    if(l == 0 || l == this.layers - 1) this.U[l][i][j] = this.init_temp;
                    else if(i == 0 || i == this.n - 1) this.U[l][i][j] = this.init_temp;
                    else if(j == 0 || j == this.layers - 1) this.U[l][i][j] = this.init_temp;
                }
            }
        }
        
        this.init()

        this.min_y = Math.min(
            this.particles[this.topology[0][this.n - 1][this.m - 1]].position[1],
            this.particles[this.topology[0][0][this.m - 1]].position[1],
            this.particles[this.topology[0][this.n - 1][0]].position[1],
            this.particles[this.topology[0][0][0]].position[1],
        )
        this.max_y = Math.max(
            this.particles[this.topology[0][this.n - 1][this.m - 1]].position[1],
            this.particles[this.topology[0][0][this.m - 1]].position[1],
            this.particles[this.topology[0][this.n - 1][0]].position[1],
            this.particles[this.topology[0][0][0]].position[1],
        )

        this.min_x = Math.min(
            this.particles[this.topology[0][this.n - 1][this.m - 1]].position[0],
            this.particles[this.topology[0][0][this.m - 1]].position[0],
            this.particles[this.topology[this.layers - 1][this.n - 1][this.m - 1]].position[0],
            this.particles[this.topology[this.layers - 1][0][this.m - 1]].position[0],
        )
        this.max_x = Math.max(
            this.particles[this.topology[this.layers - 1][this.n - 1][this.m - 1]].position[0],
            this.particles[this.topology[0][0][this.m - 1]].position[0],
            this.particles[this.topology[0][this.n - 1][0]].position[0],
            this.particles[this.topology[0][0][0]].position[0],
        )

        this.min_z = Math.min(
            this.particles[this.topology[0][this.n - 1][this.m - 1]].position[2],
            this.particles[this.topology[0][0][this.m - 1]].position[2],
            this.particles[this.topology[0][this.n - 1][0]].position[2],
            this.particles[this.topology[0][0][0]].position[2],
        )
        this.max_z = Math.max(
            this.particles[this.topology[0][this.n - 1][this.m - 1]].position[2],
            this.particles[this.topology[0][0][this.m - 1]].position[2],
            this.particles[this.topology[0][this.n - 1][0]].position[2],
            this.particles[this.topology[0][0][0]].position[2],
        )

        console.log(this.min_x, this.max_x)
        console.log(this.min_y, this.max_y)
        console.log(this.min_z, this.max_z)
    }

    init() {
        // Layer i
        //      0 1 2
        //      3 4 5
        //      6 7 8
        for(let l = 0; l<this.layers; l++) {
            let layer = []
            for(let i = 0; i<this.n; i++) {
                let row = []
                for(let j = 0; j<this.m; j++) {
                    row.push(l * this.n * this.m + i * this.n + j);
                    let new_p = new ThermoParticle(
                        0.1,
                        0.25, 
                        // vec3(4 - l * this.spacing + 1.15, i * this.spacing + 7.5, j * this.spacing + 13.75),
                        vec3(4 - l * this.spacing, i * this.spacing, j * this.spacing),
                        vec3(0, 0, 0)
                    );
                    new_p.color = color(0.039, 0.01176, 0.0078, 1) // Black
                    this.particles.push(new_p);
                }
                layer.push(row)
            }
            this.topology.push(layer)
        }

        // Add springs.
        let dirs_r = [0, -1, 0, 1]
        let dirs_c = [1, 0, -1, 0]
        for(let l = 0; l<this.layers; l++) {
            for(let i = 0; i<this.n; i++) {
                for(let j = 0; j<this.m; j++) {
                    // Check moving up one layer
                    if(this.checkbounds(l - 1, i, j)) {
                        let new_spring = new Spring(
                            this.topology[l][i][j],
                            this.topology[l - 1][i][j],
                            5,
                            1,
                            this.spacing
                        )
                        this.springs.push(new_spring);
                    }

                    // Check moving down one layer
                    if(this.checkbounds(l + 1, i, j)) {
                        let new_spring = new Spring(
                            this.topology[l][i][j],
                            this.topology[l + 1][i][j],
                            500,
                            10,
                            this.spacing
                        )
                        this.springs.push(new_spring);
                    }

                    // Check in all other directions in current layer
                    for(let dir = 0; dir < 4; dir++) {
                        let new_i = i + dirs_r[dir]
                        let new_j = j + dirs_c[dir]
                        if(this.checkbounds(l, new_i, new_j)) {
                            let new_spring = new Spring(
                                this.topology[l][i][j],
                                this.topology[l][new_i][new_j],
                                500,
                                10,
                                this.spacing
                            )
                            this.springs.push(new_spring);
                        }
                    }
                }
            }
        }
    }

    checkbounds(l, i, j) {
        if(l < 0 || l >= this.layers ||
            i < 0 || i >= this.n ||
            j < 0 || j >= this.m) return false;
        
        return true;
    }

    laplacian() {
        let dU = new Array(this.layers).fill(null).map(
            () => new Array(this.n).fill(null).map(
                () => new Array(this.m).fill(0)
            ) 
        );
        for(let l = 0; l<this.layers; l++) {
            for(let i = 0; i<this.n; i++) {
                for(let j = 0; j<this.m; j++) {
                    let U_tot = 0;
                    let cnt = 0;
                    // Check moving up one layer
                    if(this.checkbounds(l - 1, i, j)) {
                        U_tot += this.U[l - 1][i][j]
                        cnt++;
                    }

                    // Check moving down one layer
                    if(this.checkbounds(l + 1, i, j)) {
                        U_tot += this.U[l + 1][i][j]
                        cnt++;
                    }

                    // Check in all other directions in current layer
                    let dirs_r = [0, -1, 0, 1]
                    let dirs_c = [1, 0, -1, 0]
                    for(let dir = 0; dir < 4; dir++) {
                        let new_i = i + dirs_r[dir]
                        let new_j = j + dirs_c[dir]
                        if(this.checkbounds(l, new_i, new_j)) {
                            U_tot += this.U[l][new_i][new_j]
                            cnt++;
                        }
                    }

                    let U_dx = (U_tot - cnt * this.U[l][i][j]) / (this.spacing * this.spacing)
                    dU[l][i][j] = U_dx
                }
            }
        }

        return dU;
    }

    heat_step(t) {
        if(t - this.prev_t < this.d_t) return;

        this.prev_t = t;

        let dU = this.laplacian()
        this.U = this.U.map(
            (layer, l) => layer.map(
                (row, i) => row.map((val, j) => val + this.d_t * this.k * dU[l][i][j])
            )
        );

        // Set direlecht boundaries
        for(let l = 0; l<this.layers; l++) {
            for(let i = 0; i<this.n; i++) {
                for(let j = 0; j<this.m; j++) {
                    if(l == 0 || l == this.layers - 1) this.U[l][i][j] = this.init_temp;
                    else if(i == 0 || i == this.n - 1) this.U[l][i][j] = this.init_temp;
                    else if(j == 0 || j == this.layers - 1) this.U[l][i][j] = this.init_temp;
                }
            }
        }

        // console.log("UUUUU: ", this.U);
    }

    draw(caller, uniforms, materials, shapes) {
        // shapes.ball.draw( caller, uniforms, this.particles[0].particle_transform, { ...materials.plastic, color: this.particles[0].color } );
        for(let i = 0; i<this.particles.length; i++) {
            let p = this.particles[i];
            let layer = Math.floor(i / (this.n * this.m));
            let leftover = i % (this.n * this.m);
            let row = Math.floor(leftover / this.m);
            let col = leftover % this.m;
            let temp = this.U[layer][row][col];

            let red = color(1, 0, 0, 1);
            let black = color(0.039, 0.01176, 0.0078, 1);
            let color_dir = red.minus(black);
            let c = black.plus(color_dir.times(1 / this.init_temp * temp));
            p.color = c;
            shapes.ball.draw( caller, uniforms, p.particle_transform, { ...materials.plastic, color: p.color } );
        }
    }
}

class ThermoParticle extends Particle {
    constructor(mass, radius, position, velocity, t = 0) {
        super(mass, radius, position, velocity, t);

        this.temp = 0;
    }

    update_transform(){
        this.particle_transform = Mat4.translation(this.position[0], this.position[1], this.position[2])
            .times(Mat4.scale(this.radius, this.radius, this.radius));
    }
}