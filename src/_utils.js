/**
 * Copyright (c) 2019-2022, Cloudless Consulting Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

/**
 * 
 * @param  {AWSobject}	api			
 * @param  {String}		fn	
 * @param  {Boolean}	safeMode
 * 
 * @return {Promise}	
 */
const promisify = (api, fn, safeMode) => {
	const apiFn = api[fn]
	const callback = safeMode 
		? (err, data, next) => err ? next([[err], null]) : next([null, data])
		: (err, data, next, fail) => err ? fail(err) : next(data)

	return (...args) => new Promise((next,fail) => apiFn(...args, (err,data) => callback(err, data, next, fail)))
}

module.exports = {
	REGION: process.env.AWSX_REGION || process.env.AWS_REGION || process.env.REGION || process.env.DB_REGION,
	promisify
}