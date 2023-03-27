import * as secp256k1 from '@noble/secp256k1';

import { bytesToHex, hexToBytes as hexTo } from '@noble/hashes/utils';
import { composeEmail, sendEmail } from '$lib/email/email';

import { Redis } from '@upstash/redis';
import addressCodec from 'ripple-address-codec';
import hashjs from 'hash.js';
import log from '$lib/logging';
import { sha256 } from '@noble/hashes/sha256';

let redis = {};
try {
	redis = new Redis({
		url: process.env.UPSTASH_REDIS_REST_URL,
		token: process.env.UPSTASH_REDIS_REST_TOKEN
	});
} catch (e) {
	log.error('Redis connect error', e);
	process.exit(1);
}

const SEND_SOCIAL_ADDRESS = process.env.SEND_SOCIAL_ADDRESS || 'rhDEt27CCSbdA8hcnvyuVniSuQxww3NAs3';

const hexToBytes = (hex) => {
	// check if it's a hex string, starting with 0x
	if (typeof hex === 'string' && hex.match(/^0x([0-9a-f][0-9a-f])*$/i)) {
		// strip off the 0x
		hex = hex.slice(2);
	}

	return hexTo(hex);
};

const normalizePrivateKey = (privateKey) => {
	if (typeof privateKey === 'string') {
		if (privateKey.length === 66) {
			// remove 00 prefix
			privateKey = privateKey.slice(2);
		}
	}

	return privateKey;
};

const signMessage = async ({ message, address }) => {
	const hashedMessage = sha256(JSON.stringify(message));
	const { privateKey } = await getKeys(address);

	const [sig, recId] = await secp256k1.sign(hashedMessage, hexToBytes(privateKey), {
		recovered: true
	});

	return `${bytesToHex(sig)}${recId}`;
};

export const getKeys = async function (address) {
	// TODO: get seed from vault directly

	// we iterate through process.env.WALLET_SEED_* and find the one that matches the address. Values are address:data:data2
	// where data is the public key and data2 is the private key

	let found = null;
	for (const key in process.env) {
		if (key.startsWith('WALLET_SEED_')) {
			const keyString = process.env[key] as string;
			const [walletAddress, publicKey, privateKey] = keyString.split(':');

			if (walletAddress === address) {
				found = { walletAddress, publicKey, privateKey: normalizePrivateKey(privateKey) };
				break;
			}
		}
	}

	if (!found) {
		throw new Error(`Wallet seed not found for address: ${address}`);
	}

	return found;
};

const validate = async (params) => {
	const { signature, message, input } = params;

	// signature = '0x' + signature + recId // recId is last byte of signature
	const sig = signature.slice(0, -1);
	const recId = parseInt(signature.slice(-1), 10);

	function deriveAddressFromBytes(publicKeyBytes) {
		const publicKeyHash = computePublicKeyHash(publicKeyBytes);
		return addressCodec.encodeAccountID(publicKeyHash);
	}

	function computePublicKeyHash(publicKeyBytes) {
		const hash256 = hashjs.sha256().update(publicKeyBytes).digest();
		const hash160 = hashjs.ripemd160().update(hash256).digest();
		return hash160; // was Buffer.from(hash160);
	}

	// log.info(JSON.stringify({ sig, recId, message }));
	let verified = {};
	try {
		const hashedMessage = sha256(message);

		// get the public key from the signature
		const publicKey = bytesToHex(secp256k1.recoverPublicKey(hashedMessage, sig, recId, true));
		const sigAddress = deriveAddressFromBytes(hexToBytes(publicKey));

		// check if message.address matches the address derived from the signature
		if (sigAddress !== input.address) {
			throw new Error('Invalid address:' + sigAddress + ' != ' + input.address);
		}

		// verify the signature
		verified = secp256k1.verify(hexToBytes(sig), hashedMessage, hexToBytes(publicKey));

		if (!verified) {
			throw new Error('Invalid signature');
		}
	} catch (e) {
		console.log(e.message);
		throw new Error('Invalid signature');
	}

	log.debug('verified', verified);

	return verified;
};

export const submitPoolRequest = async (_, params) => {
	log.debug('---------------------', params);

	// TODO: more validation

	// check the signature to see if it came from this request and rid
	const { rid, path, signature } = params;
	let input;

	const reply = {
		status: {
			code: 200,
			message: 'OK'
		},
		response: {
			publicKey: '',
			rid,
			path,
			out: '',
			signature: ''
		}
	};

	try {
		input = JSON.parse(params.in);

		// validate the signature
		// const { keys, signature, message } = params;

		await validate({
			signature,
			message: params.in, // original stringified payload
			input,
			rid
		});

		switch (path) {
			case '/auth/email/verify': {
				const out = {};

				// check the code
				const cacheKey = `auth-email-login-${input.rid}`;
				const cached = await redis.get(cacheKey);
				if (!cached) {
					throw new Error('Invalid code');
				}

				// we can create a credential-map that this email address is owned by this address
				const credentialMap = [];
				credentialMap.push(cached.address);
				credentialMap.push(`did:kudos:email:${cached.email}`);

				// we will sign this credential map with our private key

				// create a signature
				const signature = await signMessage({
					message: credentialMap,
					address: SEND_SOCIAL_ADDRESS
				});

				out['credential-map'] = credentialMap;
				out.signature = signature;

				const mapping = {};
				mapping.costXrp = 10; // xrp
				mapping.address = SEND_SOCIAL_ADDRESS;
				mapping.terms = 'https://send-to-social.ident.agency/terms';
				mapping.expiration = 60 * 60 * 24 * 365;

				out.mapping = mapping;

				const signature2 = await signMessage({
					message: out,
					address: SEND_SOCIAL_ADDRESS
				});

				reply.response.out = JSON.stringify(out);
				reply.response.rid = input.rid; // not quite a request id, but a transaction id
				reply.response.signature = signature2;

				break;
			}
			case '/auth/email/login': {
				// start email stuff

				// generate a 6 character code from the alphabet: BCDFGHJKLMNPQRSTVWXZ
				// from: https://www.oauth.com/oauth2-servers/device-flow/authorization-server-requirements/
				const alphabet = 'BCDFGHJKLMNPQRSTVWXZ';
				const randChars = (length) =>
					Array.from({ length })
						.map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
						.join('');
				const code = `${randChars(4)}-${randChars(4)}`;

				// reply.status.message = code;

				const out = {};
				out.rid = rid;
				out.nonce = input.nonce; // client should check that this matches the nonce sent in the request

				// save the code to redis
				const cacheKey = `auth-email-login-${rid}`;
				await redis.set(cacheKey, JSON.stringify({ ...input, code }), { EX: 60 * 15 }); // 15 minutes

				// create email
				const email = input.email.trim();

				// TODO	HERE
				const output = await composeEmail({
					template: 'auth-link-01',
					options: { to: email, baseUrl: 'https://send-to-social.ident.agency', locals: { code } }
				});

				const botEmail = `"--send-to-social--" <no-reply@notify.ident.agency>`;
				const msg = {
					'h:Sender': botEmail,
					from: `no-reply@notify.ident.agency`,
					to: [email],
					//        bcc: [email],
					subject: output.subject || '--send-to-social - 🚀 Login Code',
					//text,
					html: output.html,
					//        headers, // must have h: prefix, but maybe we don't want them anyway
					// attachment: files,
					'o:tracking-clicks': 'htmlonly',
					'o:tag=': 'login'
				};

				const result = await sendEmail(msg);
				// log.debug({ result });
				out.result = result;
				// send email

				reply.response.out = JSON.stringify(out);

				break;
			}
			default: {
				reply.status.code = 400;
				reply.status.message = 'Invalid path';
				break;
			}
		}
	} catch (e) {
		log.info(e);
		if (e instanceof SyntaxError) {
			reply.status.code = 400;
			reply.status.message = 'Invalid input';
			return reply;
		}
		if (e instanceof Error) {
			if (e.message === 'Invalid signature') {
				reply.status.code = 401;
				reply.status.message = 'Invalid signature';
				return reply;
			}
		}
		throw e; // other
	}

	return reply;
};

export const setPayVia = async (_, params) => {
	log.debug('---------------------', params);

	// TODO: more validation

	// make sure we have a valid identifier
	if (!params.identifier) {
		throw new Error('Invalid identifier');
	}

	// make sure we have a valid payment method
	if (!params.value) {
		throw new Error('Invalid payment method value');
	}

	// make sure we have a valid payment method
	if (!params.type) {
		throw new Error('Invalid payment method type');
	}

	const identifier = params.identifier.toLowerCase().trim();

	// make sure it's not too big of input
	if (identifier.length > 2000) {
		throw new Error('Identifier too long');
	}
	if (params.value.length > 2000) {
		throw new Error('Payment method value too long');
	}

	return {
		type: params.type,
		value: params.value
	};
};

export default {
	setPayVia,
	submitPoolRequest
};
