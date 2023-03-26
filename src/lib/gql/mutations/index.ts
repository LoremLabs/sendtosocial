import * as secp256k1 from '@noble/secp256k1';

import { bytesToHex, hexToBytes as hexTo } from '@noble/hashes/utils';

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

const hexToBytes = (hex) => {
	// check if it's a hex string, starting with 0x
	if (typeof hex === 'string' && hex.match(/^0x([0-9a-f][0-9a-f])*$/i)) {
		// strip off the 0x
		hex = hex.slice(2);
	}

	return hexTo(hex);
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

	log.info(JSON.stringify({ sig, recId, message }));
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

	let out = '';
	const reply = {
		status: {
			code: 200,
			message: 'OK'
		},
		response: {
			publicKey: '',
			rid: '',
			path: '',
			out,
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
			case '/auth/email/login': {
				// start email stuff
				reply.status.message = 'OK!';

				break;
			}
			default: {
				reply.status.code = 400;
				reply.status.message = 'Invalid path';
				break;
			}
		}
	} catch (e) {
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
