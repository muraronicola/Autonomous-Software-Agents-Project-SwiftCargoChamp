import { Intention } from './intention.js';

export class Agent {
    constructor(client) {
        this.client = client;
        this.intention_queue = [];
        this.active = false;
        this.x;
        this.y;
        this.id;
        this.a_name;
        this.score;
        this.map;
        this.plans = [];
        this.allies = {};
    }

    async intentionLoop() {
        this.active = true;
        console.log('while true');
        while (true) {
            console.log('while true');

            if (Object.keys(this.map.availableParcels).some(k => this.map.availableParcels[k].carriedBy == this.id)) {
                this.push('go_to_delivery')
            }
            if (this.intention_queue.length > 0) {
                this.intention_queue = await this.map.filter_intentions(this.intention_queue, this.id, this.x, this.y); //Il commento è in DEBUG ONLY; DA RIATTIVARE
                console.log('intentions:', this.intention_queue.map(i => i.desire));
                // Current intention
                if (this.intention_queue.length > 0) {
                    const intention = this.intention_queue[0]; //posso non avere più intenzioni
                    try {
                        console.log('sending intention to allies');
                        this.sendToAllies(intention.toMsg());
                        await intention.achieve(this);
                    }
                    catch (error) {
                        console.log('intention failed with error:', error);
                    }
                    this.intention_queue.shift();
                    console.log('intention shifted');
                }
            }
            else {
                console.log('pushing explore');
                this.push('explore', await this.map.getSpawner(this.allies, this.x, this.y));
            }
            await new Promise(res => setImmediate(res));
        }
    }

    async push(desire, ...args) {
        if (!this.active)
            return;

        const current = new Intention(desire, ...args)

        // check if the intention is already in the queue
        if (desire == 'go_pick_up') {
            const parcel = args[0];
            if (this.intention_queue.some(i => i.desire == 'go_pick_up' && i.args[0].id == parcel.id))
                return
        }
        else if (desire == 'go_to_delivery' || desire == 'explore') {
            if (this.intention_queue.some(i => i.desire == desire))
                return
        }

        this.intention_queue.push(current);
    }

    async sendToAllies(msg) {
        for (const ally of Object.keys(this.allies)) {
            this.client.say(ally, msg);
        }
    }

    async stop() {
        for (const intention of this.intention_queue) {
            intention.stop();
        }
    }
}