import { PddlProblem } from "@unitn-asa/pddl-client";
import { Intention } from "./intention.js";
const passkey = 'SwiftCargoChamp';

export class DeliverooMap {
    // Class to represent the map of the Deliveroo environment
    // The map is represented as a 2D array of integers
    // -1: delivery cell
    // 0: empty cell
    // 1: parcel spawner cell
    // id: parcel id
    // null: not accessible cell


    /**
     * Constructor
     * @param {[integer]} width
     * @param {[integer]} height
     * @param {[tiles]} tiles
     * @returns {[DeliverooMap]}
     */
    constructor(width, height, tiles) {
        this.width = width;
        this.height = height;
        this.tiles = tiles;
        this.availableParcels = {};
        this.spawners = [];
        this.agents = {};
        this.amap = Array.from({ length: width }, () => Array(height).fill(null));
        this.default_map = Array.from({ length: width }, () => Array(height).fill(null));
        this.config = null;
        this.indice_spawners = 0;

        // fill the map
        this.tiles.forEach((t) => {
            this.amap[t.x][t.y] = t.delivery ? -1 : t.parcelSpawner ? 1 : 0;
            this.default_map[t.x][t.y] = t.delivery ? -1 : t.parcelSpawner ? 1 : 0;
            if (t.parcelSpawner)
                this.spawners.push({ x: t.x, y: t.y });
        });

        this.shuffle(this.spawners); //Otherwise the spawners are always in the same order, and the agents doesn't explore the whole map
    }

    /**
     * shuffles an array
     * @param {[array]} array 
     */
    shuffle(array) {
        let currentIndex = array.length;
        while (currentIndex != 0) {
            let randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
    }

    /**
     * set the configuration
     * @param {[object]} config 
     */
    async setConfig(config) {
        this.config = config;
    }

    /**
     * returns the next spawner to explore
     * @param {[{id: integer, x: integer, y: integer, intention: list}]} allies 
     * @param {[integer]} agent_x 
     * @param {[integer]} agent_y 
     * @returns {[x: integer, y: integer]}
     */
    async getSpawner(allies, agent_x, agent_y) {

        if (this.spawners.length == 1) { //If there is only one spawner
            let allay_to_spawner = false;
            for (const ally of Object.keys(allies)) {
                if (allies[ally].intention != undefined && allies[ally].intention.desire == 'explore') {
                    if (allies[ally].intention.args[0].x == this.spawners[0].x && allies[ally].intention.args[0].y == this.spawners[0].y) {
                        allay_to_spawner = true;
                    }
                }
            }

            if ((this.spawners[0].x == agent_x && this.spawners[0].y == agent_y) || allay_to_spawner) { //If the agent is in the spawner or an ally is going to the spawner, choose a random spot on the map instad of the spawner
                let x = Math.floor(Math.random() * this.width);
                let y = Math.floor(Math.random() * this.height);
                while (this.amap[x][y] != 0) {
                    x = Math.floor(Math.random() * this.width);
                    y = Math.floor(Math.random() * this.height);
                }
                return { x: x, y: y };
            }

        }


        this.indice_spawners = this.indice_spawners + 1 >= this.spawners.length ? 0 : this.indice_spawners + 1;
        let spawner = this.spawners[this.indice_spawners]; //Take the next spawner

        if (allies != {}) { //If there are allies, we consider their intentions to avoid conflicts
            let no_go = [];

            for (const ally of Object.keys(allies)) {
                if (allies[ally].intention != undefined && allies[ally].intention.desire == 'explore') {
                    no_go.push({ x: allies[ally].intention.args[0].x, y: allies[ally].intention.args[0].y });
                }
            }

            if (no_go.length > 0) { //If there are allies exploring, we choose a spawner that is not close to the allies
                let available_spawners = structuredClone(this.spawners)

                for (let ng of no_go) {
                    let allies_spawner_x = ng.x;
                    let allies_spawner_y = ng.y;

                    for (let i = 0; i < available_spawners.length; i++) {

                        if (Math.abs(available_spawners[i].x - allies_spawner_x) + Math.abs(available_spawners[i].y - allies_spawner_y) < this.config.PARCELS_OBSERVATION_DISTANCE) {
                            available_spawners.splice(i, 1);
                            i--;
                        }
                    }
                }

                if (available_spawners.length > 10) {
                    let random_index = Math.floor(Math.random() * available_spawners.length);
                    spawner = available_spawners[random_index]; //We choose a random spawner that is not close to the allies
                }
            }
        }

        return spawner;
    }

    /**
     * returns the distance between two points
     * @param {[integer]} x1 
     * @param {[integer]} y1 
     * @param {[integer]} x2 
     * @param {[integer]} y2 
     * @returns {[integer]}
     */
    distance(x1, y1, x2, y2) {
        const dx = Math.abs(x1 - x2)
        const dy = Math.abs(y1 - y2)
        return dx + dy;
    }

    /**
     * returns if in the given cell there is a parcel
     * @param {[integer]} x
     * @param {[integer]} y
     * @returns {[boolean]}
     */
    isParcel(x, y) {
        return this.amap[x][y] !== null && this.amap[x][y] !== -1 && this.amap[x][y] !== 0 && this.amap[x][y] !== 1;
    }

    /**
     * returns the position of the parcel with the given id or null if not found
     * @param {[string]} id 
     * @returns {[x: number, y: number]} or null
     */
    findParcel(id) {
        const i = this.amap.findIndex(row => row.includes(id));
        if (i === -1) return { x: null, y: null };
        const j = this.amap[i].indexOf(id);

        return { x: i, y: j };
    }

    /**
     * remove the parcel with the given id from the map
     * @param {[string]} id 
     */
    removeParcel(id) {
        const i = this.amap.findIndex(row => row.includes(id));
        if (i === -1) return;
        const j = this.amap[i].indexOf(id);

        this.amap[i][j] = this.default_map[i][j];
    }

    /**
     * update the parcels on the map
     * @param {*} parcels
     * @param {[integer]} x
     * @param {[integer]} y
     */
    updateParcels(parcels, x, y) {
        parcels.forEach((p) => {
            p.x = Math.round(p.x);
            p.y = Math.round(p.y);

            // in order to update the parcels we need to remove them from the map
            this.removeParcel(p.id);

            // if the parcel is not in a delivery cell or is carried by an agent, we add it to the map
            if (this.default_map[p.x][p.y] !== -1) {
                if (!p.carriedBy) {
                    this.amap[p.x][p.y] = p.id;
                }
                this.availableParcels[p.id] = p;
            }
            else {
                delete this.availableParcels[p.id];
            }
        });

        // remove parcels that are not in the observed cells anymore
        let obs_d = this.config.PARCELS_OBSERVATION_DISTANCE - 1;
        for (let i = Math.max(0, x - obs_d); i < Math.min(this.width, x + obs_d); i++) {
            for (let j = Math.max(0, y - obs_d); j < Math.min(this.height, y + obs_d); j++) {
                if (this.isParcel(i, j) && !parcels.some(p => p.id === this.amap[i][j])) {
                    if (this.distance(i, j, x, y) <= obs_d) {
                        delete this.availableParcels[this.amap[i][j]];
                        this.amap[i][j] = this.default_map[i][j];
                    }
                }
            }
        }

        // remove parcels carried by an agent
        Object.entries(this.availableParcels).forEach(([key, value]) => {
            if (value.carriedBy && value.reward == 1) {
                delete this.availableParcels[key];
            }
        });
    }

    /**
     * update the agents on the map
     * @param {*} sensed_agents 
     */
    updateAgents(sensed_agents) {
        // clear the agents
        Object.entries(this.agents).forEach(([key, value]) => {
            delete this.agents[key];
        });

        // update the agents
        sensed_agents.forEach((a) => {
            a.x = Math.round(a.x);
            a.y = Math.round(a.y);
            this.agents[a.id] = a;
        });
    }

    /**
     * reutrn the map as a string
     * @returns {[string]} 
     */
    toMsg() {
        let msg = passkey + '-map-';
        msg += JSON.stringify({ parcels: this.availableParcels, agents: this.agents });

        return msg;
    }

    /**
     * return the PDDL problem formulation to reach the goal starting from the current position
     * @param {[integer]} x 
     * @param {[integer]} y 
     * @param {[integer]} goal_x 
     * @param {[integer]} goal_y 
     * @returns {[PddlProblem]}
     */
    async PddlGoTo(x, y, goal_x, goal_y) {
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        let X = [];
        let Y = [];
        let adj = [];
        let empty = [];
        let problem = '(define (problem delivery-prob)';
        problem += '\n(:domain delivery-domain)';
        problem += '\n(:objects';
        problem += '\n agent1 - agent';
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                if (!X.includes('x' + i)) {
                    X.push('x' + i);
                }
                if (!Y.includes('y' + j)) {
                    Y.push('y' + j);
                }
                if (this.amap[i][j] !== null && !Object.values(this.agents).some(a => a.x === i && a.y === j)) {
                    empty.push('\n (empty ' + 'x' + i + ' ' + 'y' + j + ')');
                }
                for (const [dx, dy] of directions) {
                    const neighborX = i + dx;
                    const neighborY = j + dy;
                    if (neighborX >= 0 && neighborX < this.width && neighborY >= 0 && neighborY < this.height) {
                        adj.push('\n (adjacent ' + 'x' + i + ' ' + 'y' + j + ' ' + 'x' + neighborX + ' ' + 'y' + neighborY + ')');
                    }
                }
            }
        }
        problem += '\n' + X.join(' ') + ' - coordinate';
        problem += '\n' + Y.join(' ') + ' - coordinate';
        problem += '\n)';

        problem += '\n(:init';
        problem += '\n (at agent1 ' + 'x' + x + ' ' + 'y' + y + ')';
        problem += '\n (= (path-cost) 0)';
        problem += empty.join(' ');
        problem += adj.join(' ');
        problem += '\n)';

        problem += '\n(:goal (and';
        problem += '\n (at agent1 ' + 'x' + goal_x + ' ' + 'y' + goal_y + ')))';
        problem += '\n (:metric minimize (path-cost))';
        problem += '\n)';

        return problem;
    }

    /**
     * return the PDDL problem formulation to reach the nearest delivery starting from the current position
     * @param {[integer]} x 
     * @param {[integer]} y 
     * @returns {[PddlProblem]}
     */
    async PddlDelivery(x, y) {
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        let X = [];
        let Y = [];
        let adj = [];
        let cells = [];
        let problem = '(define (problem delivery-prob)';
        problem += '\n(:domain delivery-domain)';
        problem += '\n(:objects';
        problem += '\n agent1 - agent';
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                if (!X.includes('x' + i)) {
                    X.push('x' + i);
                }
                if (!Y.includes('y' + j)) {
                    Y.push('y' + j);
                }
                if (this.amap[i][j] !== null && !Object.values(this.agents).some(a => a.x === i && a.y === j)) {
                    cells.push('\n (empty ' + 'x' + i + ' ' + 'y' + j + ')');
                    if (this.amap[i][j] === -1) {
                        cells.push('\n (delivery ' + 'x' + i + ' ' + 'y' + j + ')');
                    }
                }
                for (const [dx, dy] of directions) {
                    const neighborX = i + dx;
                    const neighborY = j + dy;
                    if (neighborX >= 0 && neighborX < this.width && neighborY >= 0 && neighborY < this.height) {
                        adj.push('\n (adjacent ' + 'x' + i + ' ' + 'y' + j + ' ' + 'x' + neighborX + ' ' + 'y' + neighborY + ')');
                    }
                }
            }
        }
        problem += '\n' + X.join(' ') + ' - coordinate';
        problem += '\n' + Y.join(' ') + ' - coordinate';
        problem += '\n)';

        problem += '\n(:init';
        problem += '\n (at agent1 ' + 'x' + x + ' ' + 'y' + y + ')';
        problem += '\n (= (path-cost) 0)';
        problem += cells.join(' ');
        problem += adj.join(' ');
        problem += '\n)';

        problem += '\n(:goal';
        problem += '\n (exists (?x - coordinate ?y - coordinate)';
        problem += '\n (and (delivery ?x ?y) (at agent1 ?x ?y))))';
        problem += '\n (:metric minimize (path-cost))';
        problem += '\n)';

        return problem;
    }

    /**
     * return a plan to reach the goal
     * @param {[integer]} x starting x position
     * @param {[integer]} y starting y position
     * @param {[string]} goal the goal of the search: 'D' for delivery, 'P' for parcel, 'C' for coordinates
     * @param {[integer]} gx needed if goal is 'C' to specify the x coordinate of the goal
     * @param {[integer]} gy needed if goal is 'C' to specify the y coordinate of the goal
     * @returns {Array<[ { x:integer, y:integer, mov:string } ]>}
     */
    async bfs(x, y, goal, gx = -1, gy = -1) {
        if (this.amap === null || this.amap === undefined || x === undefined || y === undefined) {
            return undefined;
        }
        const queue = [];
        const visited = new Set();
        const directions = [[-1, 0, 'left'], [1, 0, 'right'], [0, -1, 'down'], [0, 1, 'up']]; // Because the map is rotated
        let mov = 's';
        queue.push([{ x, y, mov }]);
        visited.add(`${x},${y}`);

        while (queue.length > 0) {
            let decay = this.config.PARCEL_DECADING_INTERVAL;
            let rateDecayPacket = decay == 'infinite' ? 0 : 1 / decay.split('s')[0];
            let agentSpeed = 1000 / this.config.MOVEMENT_DURATION;
            const path = queue.shift();
            const { x: currX, y: currY, mov: curMov } = path[path.length - 1];

            let value = this.amap[currX][currY];

            // Process the current node here
            switch (goal) {
                case 'D': // Delivery
                    if (this.amap[currX][currY] === -1) {
                        return path.filter(element => element.mov !== 's');
                    }
                    break;
                case 'P': // Parcel
                    if (value !== null && value !== -1 && value !== 0 && value !== 1) {
                        if (value in this.availableParcels && this.availableParcels[value].carriedBy === null) {
                            let toD = await this.bfs(currX, currY, 'D');
                            if (toD == undefined)
                                return undefined;
                            if (((toD.length + path.length)/agentSpeed) * rateDecayPacket < this.availableParcels[value].reward) { //If the reward is enough to take the parcel
                                const newPath = path.concat(toD);
                                return newPath.filter(element => element.mov !== 's');
                            }
                        }
                    }
                    break;
                case 'C': // Coordinates
                    if (currX == gx && currY == gy) {
                        return path.filter(element => element.mov !== 's');
                    }
                    break;
            }

            // Check the neighbors
            for (const [dx, dy, dir] of directions) {
                const neighborX = currX + dx;
                const neighborY = currY + dy;
                const neighborKey = `${neighborX},${neighborY}`;

                // Skip if the neighbor is already visited or out of bounds
                if (visited.has(neighborKey) || neighborX < 0 || neighborX >= this.width || neighborY < 0 || neighborY >= this.height) {
                    continue;
                }

                // Skip if the neighbor is null
                if (this.amap[neighborX][neighborY] === null) {
                    continue;
                }

                // Skip if the neighbor is an agent
                let agentCell = Object.entries(this.agents).filter(([key, value]) => value.x === neighborX && value.y === neighborY).map(([key, value]) => value);
                if (agentCell.length != 0) {
                    continue;
                }

                // Add the neighbor to the queue, mark it as visited, and update the path
                queue.push([...path, { x: neighborX, y: neighborY, mov: dir }]);
                visited.add(neighborKey);
            }
        }
    }

    /**
     * return the list of the reachable parcels from the current position in descending order of reward
     * @param {[integer]} x
     * @param {[integer]} y
     * @returns {Array<[ id:string, reward:number ]>}
     */
    async best_parcels(x, y) {
        const queue = [];
        const visited = new Set();
        const options = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        queue.push([{ x: x, y: y }]);
        visited.add(`${x},${y}`);

        while (queue.length > 0) {
            let decay = this.config.PARCEL_DECADING_INTERVAL;
            let rateDecayPacket = decay == 'infinite' ? 0 : 1 / decay.split('s')[0];
            let agentSpeed = 1000 / this.config.MOVEMENT_DURATION;
            const path = queue.shift();
            const { x: currX, y: currY } = path[path.length - 1];

            let value = this.amap[currX][currY];
            if (this.isParcel(currX, currY)) {
                if (value in this.availableParcels && this.availableParcels[value].carriedBy === null) {
                    let toD = await this.bfs(currX, currY, 'D');
                    if (toD) {
                        let parcel = this.availableParcels[value]
                        if (parcel != undefined)
                            if (((toD.length + path.length)/agentSpeed) * rateDecayPacket < parcel.reward){ //If the reward is enough to take the parcel
                                options.push([parcel, parcel.reward - (((toD.length + path.length)/agentSpeed) * rateDecayPacket)])
                            }
                    }
                }
            }

            // Check the neighbors
            for (const [dx, dy] of directions) {
                const neighborX = currX + dx;
                const neighborY = currY + dy;
                const neighborKey = `${neighborX},${neighborY}`;

                // Skip if the neighbor is already visited or out of bounds
                if (visited.has(neighborKey) || neighborX < 0 || neighborX >= this.width || neighborY < 0 || neighborY >= this.height) {
                    continue;
                }

                // Skip if the neighbor is null
                if (this.amap[neighborX][neighborY] === null) {
                    continue;
                }

                // Skip if the neighbor is an agent
                let agentCell = Object.entries(this.agents).filter(([key, value]) => value.x === neighborX && value.y === neighborY).map(([key, value]) => value);
                if (agentCell.length != 0) {
                    continue;
                }

                // Add the neighbor to the queue, mark it as visited, and update the path
                queue.push([...path, { x: neighborX, y: neighborY }]);
                visited.add(neighborKey);
            }
        }

        options.sort((a, b) => b[1] - a[1]);
        return options
    }

    /**
     * return the filtered and sorted intentions
     * @param {[Agent]} myAgent
     * @returns {Array<[ { desire:string, args:any } ]>}
     */
    async filter_intentions(intention_queue, id, x, y) {
        let p_rewards = [];
        let decay = this.config.PARCEL_DECADING_INTERVAL;
        let rateDecayPacket = decay == 'infinite' ? 0 : 1 / decay.split('s')[0];
        let agentSpeed = 1000 / this.config.MOVEMENT_DURATION;
        
        if (!Object.keys(intention_queue).some(k => intention_queue[k].desire == 'go_to_delivery')) {
            if (Object.keys(this.availableParcels).some(k => this.availableParcels[k].carriedBy == id)) {
                intention_queue.push(new Intention('go_to_delivery'));
            }
        }

        for (let i = 0; i < intention_queue.length; i++) {
            let intention = intention_queue[i];
            let desire = intention.desire;
            let args = intention.args[0];
            let me2D = await this.bfs(x, y, 'D');
            let carriedParcels = Object.entries(this.availableParcels).filter(([key, value]) => value.carriedBy === id).map(([key, value]) => value);
            let carriedReward = carriedParcels.reduce((acc, p) => acc + p.reward, 0);
            switch (desire) {
                case 'go_pick_up':
                    if (this.availableParcels[args.id] !== undefined) {
                        args = this.availableParcels[args.id];
                        if (args.carriedBy == null) { //If is not carried by anyone
                            let toP = await this.bfs(x, y, 'C', args.x, args.y);
                            let toD = await this.bfs(args.x, args.y, 'D');
                            if (toD && toP) {
                                if (((toD.length + toP.length)/agentSpeed) * rateDecayPacket < args.reward) { //If the reward is enough to take the parcel
                                    let parcel_reward = args.reward - (((toD.length + toP.length)/agentSpeed) * rateDecayPacket);
                                    p_rewards.push([intention, parcel_reward])
                                }
                            }
                        }
                    }
                    break;
                case 'go_to_delivery':

                    if (me2D) {
                        carriedReward = carriedReward - ((carriedParcels.length/agentSpeed) * me2D.length * rateDecayPacket);
                        if (me2D.length * rateDecayPacket < carriedReward) {
                            if (rateDecayPacket != 0){ //If the decay is not infinite
                                p_rewards.push([intention, carriedReward])
                            }
                            else 
                            {
                                p_rewards.push([intention, carriedReward*0.1]) //If the decay is infinite, we consider to take more parcels before going to the delivery
                            }
                        }
                    }
                    break;
                case 'explore':
                    p_rewards.push([intention, -1])
                    break;
            }
        }
        p_rewards.sort((a, b) => b[1] - a[1]); //Sort the intentions by reward
        p_rewards = p_rewards.map(([intention, reward]) => intention);

        return p_rewards;
    }

    /**
     * reconsider the current intentions, return the new intentions
     * @param {[Array]} intention_queue
     * @param {[integer]} id
     * @param {[integer]} x
     * @param {[integer]} y
     * @returns {[Array]}
     */
    async reconsider(intention_queue, id, x, y) {
        let current_intention = intention_queue[0];
        if (current_intention == undefined || current_intention == null) { //aggiunta
            return [];
        }
        let desire = current_intention.desire;
        let args = current_intention.args[0];
        let new_intention = await this.filter_intentions(intention_queue, id, x, y);
        
        if (new_intention.length > 0) {
            if (new_intention[0].desire !== desire) {
                console.log('=== reconsidered desire ===');
                current_intention.stop();
            }
            else if (desire === 'go_pick_up' && new_intention[0].args[0].id !== args.id) {
                console.log('=== reconsidered go_pick_up ===');
                current_intention.stop();
            }
        }
        return new_intention || [];
    }
}