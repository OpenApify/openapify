import * as puppeteer from 'puppeteer';
import * as url from 'url';


let Log: any = (...v:any[])=>{};

export function SetLog(fn: any) {
    Log = fn;
}

export function Apify (job: Job, config?: Config):Promise<object> {
    return new Promise(async (resolve) => {
        config = initConfig(config);
        job.State = 'running';
        job.StartTime = Date.now();
        Log(`Creating browser`);
        const browser = await puppeteer.launch({
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-gpu"
            ],
            headless: config.Headless,
        });
        Log(`Creating new page`);
        const page = await browser.newPage();
        Log(`Setting ViewPort`);
        await page.setViewport(job.Viewport);


        Log(`Navigating to ${job.Url}`);
        await page.goto(job.Url, {waitUntil: 'networkidle2'});
        
        Log(`Taking screenshot`);
        job.Screenshot = await page.screenshot();

        if (config.BreakBeforeInject === true) {
            Log(`Waiting for proceed`);
            await new Promise(async resolve => {
                await page.exposeFunction('openapify_continue', () => {
                    resolve()
                });
            })
            Log(`Continuing execution`);
        }
        
        Log(`Injecting ${job.Scripts.length} scripts`);
        for (let i = 0; i < job.Scripts.length; i++) {
            Log(`Injecting '${job.Scripts[i]}'`);
            await page.addScriptTag({url: job.Scripts[i]});
        }

        if (config.BreakBeforeFunction === true) {
            Log(`Waiting for proceed`);
            await new Promise(async resolve => {
                await page.exposeFunction('openapify_continue', () => {
                    resolve()
                });
            })
            Log(`Continuing execution`);
        }
        Log(`Running function \`${job.Function.toString()}\``);
        try {
            const result = await page.evaluate(job.Function);
            job.Result = result;
        } catch (e) {
            job.Result = {
                'Error': e.toString(),
            };
        }
        Log(`Result: `, job.Result);
        Log(`Closing Browser`);
        browser.close();
        job.State = 'completed';
        job.EndTime = Date.now();
        resolve(job.Result);
    });
}

export type ScriptFunction = (...args:any[]) => any;
export class Job {
    Id: string;
    Url: string;
    StartTime: number;
    private _endTime: number;
    TimeTaken: number;
    private _scripts: string[];
    Function: ScriptFunction;
    State: string;
    Result: object;
    Screenshot: Buffer;
    Viewport: puppeteer.Viewport;

    constructor(Url: string, Scripts: string[], Function: ScriptFunction) {
        let parsedURL = url.parse(Url);
        if ((parsedURL.protocol != 'http:' && parsedURL.protocol != 'https:') || parsedURL.path == null) {
            throw 'Invalid URL';
        }
        this.Url = Url;
        this.Id = this.generateId();
        this.Scripts = Scripts;
        this.Function = Function;
        this.Viewport = {
            width: 1600,
            height: 800,
        }
    }

    static FromData(data: object): Job {
        if (checkEmpty(data['Url'])) {
            throw 'Url is missing'
        }
        if (checkEmpty(data['Function'])) {
            throw 'Function is missing'
        }
        let job = new Job(data['Url'], data['Scripts'], data['Function']);
        if (!checkEmpty(data['Id'])) {
            job.Id = data['Id'];
        }
        if (!checkEmpty(data['Id'])) {
            job.Id = data['Id'];
        }
        if (!checkEmpty(data['StartTime'])) {
            job.StartTime = data['StartTime'];
        }
        if (!checkEmpty(data['EndTime'])) {
            job.EndTime = data['EndTime'];
        }
        if (!checkEmpty(data['State'])) {
            job.State = data['State'];
        }
        if (!checkEmpty(data['Viewport'])) {
            job.Viewport = data['Viewport'];
        }
        if (!checkEmpty(data['Result'])) {
            job.Result = data['Result'];
        }
        return job;
    }

    ToData(): object {
        return {
            'Id': this.Id,
            'Url': this.Url,
            'StartTime': this.StartTime,
            'EndTime': this.EndTime,
            'TimeTaken': this.TimeTaken,
            'Scripts': this.Scripts,
            'Function': this.Function,
            'State': this.State,
            'Result': this.Result,
            'Viewport': this.Viewport,
            'Screenshot': !checkEmpty(this.Screenshot) ? `data:image/png;${this.Screenshot.toString('base64')}` : null,
        };
    }

    
    private generateId() : string {
        function s4(): string {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }


    set Scripts(scripts: string[]) {
        if (scripts == null || scripts == undefined) {
            this._scripts = [];
        } else {
            this._scripts = scripts;
        }
    }

    get Scripts(): string[] {
        return this._scripts;
    }
    
    set EndTime(endTime: number) {
        this.TimeTaken = endTime - this.StartTime;
        this._endTime = endTime;
    }

    get EndTime(): number {
        return this._endTime;
    }
}

export interface Config {
    Headless?: boolean;
    BreakBeforeInject?: boolean;
    BreakBeforeFunction?: boolean;
}

function initConfig(config: Config): Config {
    if (checkEmpty(config)) {
        return {
            Headless: true,
            BreakBeforeInject: false,
            BreakBeforeFunction: false,
        };
    }
    if (checkEmpty(config.Headless)) {
        config.Headless = true;
    }
    if (checkEmpty(config.BreakBeforeInject)) {
        config.BreakBeforeInject = false;
    }
    if (checkEmpty(config.BreakBeforeFunction)) {
        config.BreakBeforeFunction = false;
    }
    return config;
}
function checkEmpty(o:any): boolean {
    return (o === undefined || o === null);        
}


