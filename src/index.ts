import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { createUser, deleteAll } from './db/queries/users.js';
import { createChirp } from './db/queries/chirps.js';
import { 
	config,
	BadRequestError,
	UnauthorizedError,
	ForbiddenError,
	NotFoundError
} from './config.js';

const app = express();
const PORT = 8080;


const migrationClient = postgres(config.db.url, { max: 1 });
await migrate(drizzle(migrationClient), config.db.migrationConfig);

function middlewareLogResponses(req: Request, res: Response, next: NextFunction): void {
	res.on('finish', () => {
		const statusCode = res.statusCode;
		if(statusCode !== 200 && statusCode !== 201) {
			console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${statusCode}`)
		}
	});
	next();
}

function middlewareMetricsInc(req: Request, res: Response, next: NextFunction): void {
	config.fileServerHits += 1;
	next();
}

function writeNumberOfHits(req: Request, res: Response, next: NextFunction): void {
	res.set('Content-Type', 'text/html;charset=utf-8');
	res.send(`
		<html>
			<body>
				<h1>Welcome, Chirpy Admin</h1>
				<p>Chirpy has been visited ${config.fileServerHits} times!</p>
			</body>
		</html>
	`);
	next();
}

function resetFileServerHits(req: Request, res: Response, next: NextFunction): void {
	config.fileServerHits = 0;
	next();
}

function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
	if(err instanceof BadRequestError) {
		res.status(400).send({ error: err.message });
	} else if(err instanceof UnauthorizedError) {
		res.status(401).send({ error: err.message });
	} else if(err instanceof ForbiddenError) {
		res.status(403).send({ error: err.message });
	} else if(err instanceof NotFoundError) {
		res.status(404).send({ error: err.message });
	} else {
		res.status(500).send({ error: "Internal Server Error"})
	}
	next();
}

app.use(middlewareLogResponses);
app.use(express.json());
app.use("/app", middlewareMetricsInc, express.static('./src/app'));
app.use(errorHandler);

app.get('/admin/metrics', writeNumberOfHits);

app.post('/admin/reset', resetFileServerHits, async (req: Request, res: Response, next: NextFunction) => {
	if(config.platform !== 'dev') {
		errorHandler(new ForbiddenError('Forbidden request in current environment'), req, res, next);
	} 

	await deleteAll();
	res.set('Content-Type', 'text/plain');
	res.status(200).send('All users deleted');	
});

app.post('/api/users', async (req: Request, res: Response, next: NextFunction) => {
	const resp = await createUser(req.body);

	res.status(201).send(resp);
});

app.post('/api/chirps', async (req: Request, res: Response, next: NextFunction) => {
	type parameters = {
		body: string;
		userId: string;
	}

	try {
		const reqBody: parameters = req.body;
	 	const { body: chirp, userId } = reqBody;
	 	if(chirp.length <= 140) {
	 		let chirpArr = chirp.split(' ');
	 		const isProfrane = (word: string) => word === 'kerfuffle' || word === 'sharbert' || word === 'fornax';
	 		chirpArr = chirpArr.map(word => {
	 			return isProfrane(word.toLowerCase()) ? '****' : word;
	 		});
	 		const validChirp = chirpArr.join(' ');
	 		const newChirp = await createChirp({ body: validChirp, userId });
	 		
	 		res.status(201).send(newChirp);
	 	} else {
	 		errorHandler(new BadRequestError('Chirp is too long. Max length is 140'), req, res, next);
	 	}
	} catch (err) {
		next(err);
	}
});

app.get('/api/healthz', middlewareMetricsInc, (req: Request, res: Response) => {
	// set the content-type header in the response
	res.set('Content-Type', 'text/plain');
	res.send('OK');
});

app.listen(PORT, () => {
	console.log('Server is running http://localhost:', + PORT);
})