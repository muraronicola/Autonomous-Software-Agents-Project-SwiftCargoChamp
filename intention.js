const passkey = 'SwiftCargoChamp';

export class Intention extends Promise {
    #current_plan;
    stop() {
        if (this.#current_plan != undefined)
            this.#current_plan.stop();
    }

    #desire;
    #args;
    #started;

    #resolve;
    #reject;

    /**
     * Constructor
     * @param {[string]} desire - The desire to be achieved
     * @param  {[...any]} args - The arguments to be passed to the class
     */
    constructor(desire, ...args) {
        var resolve, reject;
        super(async (res, rej) => {
            resolve = res; reject = rej;
        })
        this.#resolve = resolve
        this.#reject = reject
        this.#desire = desire;
        this.#args = args;
        this.#started = false;
    }

    /**
     * Return the desire of the intention
     * @returns {[string]}
     */
    get desire() {
        return this.#desire;
    }

    /**
     * Return the arguments of the intention
     * @returns {[...any]}
     */
    get args() {
        return this.#args;
    }

    /**
     * Return the string representation of the intention
     * @returns {[string]}
     */
    toMsg() {
        let msg = passkey + '-intention-';
        msg += JSON.stringify(this);
        return msg;
    }

    /** 
     *  Custom toJSON method to include private fields
     *  @returns {[object]}
     */
    toJSON() {
        return {
            desire: this.#desire,
            args: this.#args,
            started: this.#started
        };
    }

    /**
     * Achieve an intention of the agent
     * @param {[object]} myAgent
     */
    async achieve(myAgent) {
        if (this.#started) // If the intention has already been started, return this
            return this;
        else
            this.#started = true;
        
        for (const plan of myAgent.plans) {
            if (await plan.isApplicableTo(this.#desire, myAgent.x, myAgent.y, myAgent.allies, myAgent.map, myAgent.intention_queue)) {
                this.#current_plan = plan;
                console.log("plan applicable", plan);
                try { //Try executing the plan
                    const plan_res = await plan.execute(myAgent, ...this.#args);
                    this.#resolve(plan_res);
                    console.log('plan', plan, 'succesfully achieved intention', this.#desire, ...this.#args, 'with result', plan_res);
                    return plan_res
                } catch (error) {
                    console.log('plan', plan, 'failed while trying to achieve intention', this.#desire, ...this.#args, 'with error', error);
                }
            }else{
                console.log("plan not applicable", plan);
            }
        }
    }
}