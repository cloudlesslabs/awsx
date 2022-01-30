/**
 * Copyright (c) 2019-2022, Cloudless Consulting Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

const { error:{ catchErrors, wrapErrors } } = require('puffy-core')
const AWS = require('aws-sdk')
const { REGION, promisify } = require('./_utils')
const logs = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28', region: REGION })

const MINUTE = 60*1000
const HOUR = 60*MINUTE
const DAY = 24*HOUR
const WEEK = 7*DAY
const MAX_ITERATION = 100

// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudWatchLogs.html#filterLogEvents-property
const _logsFilterLogEvents = promisify(logs, 'filterLogEvents', true)

/** 
 * Gets logs from a log group. The logs are sorted in ascending order based on the ingestion time (this cannot be changed).
 * 
 * Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudWatchLogs.html#filterLogEvents-property
 * 
 * @param  {Object} 		query
 * @param  {Object} 			.where
 * @param  {String} 				.logGroup			Required (e.g., '/aws/lambda/lineup-workloads-project-api-dev')
 * @param  {Object}		 			.timeRange
 * @param  {Object}		 				.last			Default 3 hours
 * @param  {Number}		 					.value		Default 3
 * @param  {Number}		 					.unit		Allowed values: 'minute', 'hour' (default), 'day', 'week'
 * @param  {Date|String}		 		.startDateUTC
 * @param  {Date|String}		 	.	.endDateUTC
 * @param  {String} 				.nextToken
 * @param  {String} 				.filterPattern		(1)
 * @param  {Number} 			.limit					Default 10,000 (which is the max allowed)
 * @param  {String}		 		.sort					Allowed values: 'asc' (default), 'desc'
 * @param  {Boolean}		 	.all					Default false. True means that all values for that time range are retrieved.
 * 
 * @return {Object}			response
 * @return {Number}				.count					Total events.
 * @return {[Object]}			.events[]
 * @return {String}					.logStreamName
 * @return {Date}					.timestamp			UTC time when the log was recorded			
 * @return {String}					.message
 * @return {Date}					.ingestionTime		UTC time when the log added to CloudWatch
 * @return {String}					.eventId
 * @return {Number}				.iteration				Number of API requests performed in order to get all the data. (max. 100).
 * @return {String}				.message				Warning message if max iteration reached.
 * @return {String}				.nextToken
 *
 * (1) Example:
 * 	- 'ERROR' returns all message that contains the string 'ERROR'. Both 'ERROR 123 oh no' and 'ERRORCODE -1' would match.
 * 	- '"ERROR" "no"' returns all message that contains the string both 'ERROR' and 'no'. With Both 'ERROR 123 oh no' and 'ERRORCODE -1' only the first one would match.
 *
 * Full doc at https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html
 * 
 */
const select = query => catchErrors((async () => {
	const e = (...args) => wrapErrors('Failed to select CloudWatch logs', ...args)

	const { where, limit, sort, all } = query || {}

	let { logGroup, nextToken, filterPattern, timeRange } = where || {}
	let { last, startDateUTC, endDateUTC } = timeRange || {}

	if (!logGroup)
		throw e('Missing required argument \'query.where.logGroup\'')
	
	const params = {
		logGroupName: logGroup,
		limit: all ? 10000 : limit || 10000
	}

	if (nextToken) 
		params.nextToken = nextToken

	if (filterPattern) 
		params.filterPattern = filterPattern

	if (last) {
		const { value, unit  } = last || {}
		const t = isNaN(value*1) || value*1 <= 0 ? 3 : value*1
		const milliseconds = unit == 'minute' ? MINUTE : (!unit || unit == 'hour') ? HOUR : unit == 'day' ? DAY : unit == 'week' ? WEEK : null
		if (t && !milliseconds)
			throw e(`Wrong argument exception. 'unit' value '${unit}' is not supported.`)
		
		params.startTime = Date.now() - t*milliseconds
		params.endTime = Date.now()
	} else {
		if (!startDateUTC && !endDateUTC) {
			params.startTime = Date.now() - 3*HOUR
			params.endTime = Date.now()
		} else {
			if (startDateUTC) {
				if (!(startDateUTC instanceof Date)) {
					startDateUTC = new Date(startDateUTC)
					if (isNaN(startDateUTC))
						throw e(`Wrong argument exception. 'startDateUTC' is expected to be a date or a parseable date (e.g., '2021-12-26'). Failed to parse ${startDateUTC} to a UTC date.`)
				}
				params.startTime = startDateUTC.getTime()
			}
			if (endDateUTC) {
				if (!(endDateUTC instanceof Date)) {
					endDateUTC = new Date(endDateUTC)
					if (isNaN(endDateUTC))
						throw e(`Wrong argument exception. 'endDateUTC' is expected to be a date or a parseable date (e.g., '2021-12-26'). Failed to parse ${endDateUTC} to a UTC date.`)
				}
				params.endTime = endDateUTC.getTime()
			}
		}
	}

	// Maximum amount of data retrieved is 100 request (i.e., 100MB).
	const count = all ? MAX_ITERATION : 1
	const events = []
	let next, iteration = 0
	for (let i=0;i<count;i++) {
		iteration++
		const p = { ...params }
		if (next)
			p.nextToken = next

		const [errors, result] = await _logsFilterLogEvents(p)
		if (errors)
			throw e(`Failed to extract logs after the ${iteration}th iteration`, errors)

		next = (result||{}).nextToken
		events.push(...((result||{}).events||[]))

		if (!next)
			break
	}

	const data = {
		count: events.length,
		nextToken:next||null,
		iteration,
		message: iteration == MAX_ITERATION && next ? `WARNING: Max iteration(${MAX_ITERATION}) exceeded. Failed to extract all logs. Reduce the time range in order to fit all the data.` : null
	}

	const dir = sort == 'desc' ? -1 : 1 
	if (data.count)
		data.events = events.sort((a,b) => a.timestamp < b.timestamp ? -dir : dir).map(e => {
			const timestamp = new Date(e.timestamp)
			const ingestionTime = new Date(e.ingestionTime)
			return {
				...e,
				timestamp,
				ingestionTime
			}
		})

	return data
})())


module.exports = {
	logs: {
		select
	}
}





