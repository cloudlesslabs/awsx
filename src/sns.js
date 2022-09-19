/**
 * Copyright (c) 2019-2022, Cloudless Consulting Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

// Main doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SNS.html

const { error:{ catchErrors, wrapErrorsFn } } = require('puffy-core')
const AWS = require('aws-sdk')
const { REGION, promisify } = require('./_utils')
const sns = new AWS.SNS({ apiVersion: '2010-03-31', region:REGION })

// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SNS.html#publish-property
const _publish = promisify(sns, 'publish', true)

/**
 * Maps our lean attributes to AWS more verbose attributes.
 * 
 * @param  {Object} attributes 	e.g., 	{ 
 *							  			'your-attribute-name-1': 'whatever value', 
 *							  			'your-attribute-name-2': 123,
 *							  			'your-attribute-name-3': { hello: 'world' },
 *							  			'your-attribute-name-4': 00 03 05,
 *							  		}
 *							  		
 * @return {Object}				e.g., 	{
 *											'your-attribute-name-1': {
 *												DataType: 'String',
 *												StringValue: 'whatever value'
 *											},
 *											'your-attribute-name-2': {
 *												DataType: 'Number',
 *												StringValue: 123
 *											},
 *											'your-attribute-name-3': {
 *												DataType: 'String',
 *												StringValue: '{ "hello":"world" }'
 *											},
 *											'your-attribute-name-4': {
 *												DataType: 'Binary',
 *												BinaryValue: 00 03 05
 *											}
 *						   			}
 */
const _formatAttr = attributes => {
	if (!attributes || typeof(attributes) != 'object')
		return 

	const attrNames = Object.keys(attributes)
	if (!attrNames || !attrNames.length)
		return

	return attrNames.reduce((acc,key) => {
		const value = attributes[key]
		const t = typeof(value)
		acc[key] = value instanceof Buffer 
			? { DataType: 'Binary', BinaryValue:value } 
			: t == 'object' 
				? { DataType: 'String', StringValue: JSON.stringify(value) }
				: t == 'string'
					? { DataType: 'String', StringValue: value }
					: t == 'number'
						? { DataType: 'Number', StringValue: value }
						: { DataType: 'String', StringValue: `${value}` }

		return acc 
	}, {})
}

/**
 * Publishes a message to an SNS topic.
 * Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SNS.html#publish-property
 * 
 * @param  {String}			topicARN							topic's ARN
 * @param  {String|Object}	payload.body						The body can be anything, but eventually, it is stringified.
 *																(WARNING: Max size is 250KB)
 * @param  {Object}			payload.attributes					e.g., { 'your-attribute-name': 'whatever value' }
 * @param  {String}			options.phone						E.164 format phone number (e.g., +61420496232)
 * @param  {String}			options.subject
 * @param  {String}			options.type						Valid values: 'promotional' or 'transactional'
 * 
 * @yield  {String}			output.ResponseMetadata.RequestId
 * @yield  {String}			output.MessageId	
 */
const publish = (topicARN, payload, options) => catchErrors((async () => {
	const e = wrapErrorsFn('Failed to publish message to topic')

	if (!topicARN)
		throw e('Missing required argument \'topicARN\'')
	if (!payload)
		throw e('Missing required argument \'payload\'')

	const { phone, subject, type } = options || {}
	const { body, attributes } = typeof(payload) == 'string' ? { body:payload } : (payload || {})

	if (!body)
		throw e('Missing required argument \'payload.body\'')

	const Message = typeof(body) == 'object' ? JSON.stringify(body) : `${body}`
	let MessageAttributes = attributes 
		? _formatAttr(attributes)
		: {}

	let params = { 
		Message, 
		MessageAttributes
	}

	if (phone)
		params.PhoneNumber = phone
	else
		params.TopicArn = topicARN

	if (subject){
		if (phone) {
			const senderId = subject.replace(/\s*/g,'').substring(0,11)
			MessageAttributes = { ...MessageAttributes, ..._formatAttr({ 'AWS.SNS.SMS.SenderID':senderId }) }
		} else
			params.Subject = subject
	}

	if ((type == 'promotional' || type == 'transactional') && phone) 
		MessageAttributes = { ...MessageAttributes, ..._formatAttr({ 'AWS.SNS.SMS.SMSType':type == 'promotional' ? 'Promotional' : 'Transactional' }) }

	const [errors, resp] = await _publish(params)
	if (errors)
		throw e(errors)

	return resp
})())

class Topic {
	constructor(arn) {
		if (!arn)
			throw new Error('Missing required argument \'arn\'')

		this.arn = arn
	}

	publish(payload, options) {
		return publish(this.arn, payload, options)
	}
}

module.exports = {
	Topic
}


