import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { 
	createUser, 
	deleteAll,
	getUser
} from './db/queries/users.js';
import type { UserResponse } from './db/queries/users.js';
import { 
	createChirp,
	getAllChirps,
	getChirp
} from './db/queries/chirps.js';
import { 
	checkPasswordHash, 
	makeJwt, 
	validateJwt,
	getBearerToken
} from './db/auth.js';
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

app.post('/api/login', async (req: Request, res: Response, next: NextFunction) => {
	const { email, password } = req.body;
	const expiresIn = req.body?.expiresInSeconds !== undefined 
		? req.body.expiresInSeconds > 3600 
			? 3600 
			: req.body.expiresInSeconds 
		: 3600;
	
	try {
		// lookup user by email
		const user = await getUser(email);
		// compare password and hashedPassword using checkPasswordHash function
		const isValidUser = await checkPasswordHash(password, user.hashedPassword);
		if(isValidUser) {
			const { hashedPassword: _, ...validUser } = user;
			const token = makeJwt(validUser.id, expiresIn, config.secret)
			res.status(200).send({ ...validUser, token });
		} else {
			errorHandler(
				new UnauthorizedError('Incorrect email or password'),
				req,
				res,
				next
			);
		}
	} catch (err) {
		// if there's any err, call errorHandler w/ new UnauthorizedError('Incorrect email or password')
		errorHandler(
			new UnauthorizedError('Incorrect email or password'),
			req,
			res,
			next
		);
	}
});

app.post('/api/chirps', async (req: Request, res: Response, next: NextFunction) => {
	type parameters = {
		body: string;
	}

	try {
		const reqBody: parameters = req.body;
	 	const { body: chirp } = reqBody;
	 	const token = getBearerToken(req);
	 	const tokenSub = validateJwt(token, config.secret);

	 	if(tokenSub && chirp.length <= 140) {
	 		let chirpArr = chirp.split(' ');
	 		const isProfrane = (word: string) => word === 'kerfuffle' || word === 'sharbert' || word === 'fornax';
	 		chirpArr = chirpArr.map(word => {
	 			return isProfrane(word.toLowerCase()) ? '****' : word;
	 		});
	 		const validChirp = chirpArr.join(' ');
	 		const newChirp = await createChirp({ body: validChirp, userId: tokenSub });
	 		
	 		res.status(201).send(newChirp);
	 	} else {
	 		errorHandler(new BadRequestError('Chirp is too long. Max length is 140'), req, res, next);
	 	}
	} catch (err) {
		next(err);
	}
});

app.get('/api/chirps', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const chirps = await getAllChirps();

		res.status(200).send(chirps);
	} catch (err) {
		errorHandler(
			new BadRequestError('Something has gone wrong. Please try again.'),
			req,
			res,
			next
		);
	}
});

app.get('/api/chirps/:chirpID', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const chirp = await getChirp(req.params.chirpID);

		res.status(200).send(chirp);
	} catch (err) {
		errorHandler(new NotFoundError('Chirp not found.'), req, res, next);
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