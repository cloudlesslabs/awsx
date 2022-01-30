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
const ssm = new AWS.SSM({ apiVersion: '2014-11-06', region:REGION })

// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SSM.html#getParameter-property
const _ssmGetParameter = promisify(ssm, 'getParameter')
// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SSM.html#putParameter-property
const _ssmPutParameter = promisify(ssm, 'putParameter')

/**
 * Gets a parameter from AWS Parameter Store.
 * 
 * WARNING: Requires the 'ssm:GetParameter' permission in the policy.
 * 
 * @param  {String}		name
 * @param  {String}		version                        Optional. If null, then the latest version is returned.    
 * @param  {Boolean}	json                            Default false. True means the Value is parsed to JSON.
 * 
 * @return {Object}		output
 * @return {String}			.name
 * @return {String}			.type                    Valid values: 'String', 'StringList', 'SecureString'
 * @return {String}			.value                    If 'json' is true, this is an object.
 * @return {Number}			.version
 * @return {Date}			.lastModifiedDate        UTC date
 * @return {String}			.arn
 * @return {String}			.dataType                Valid values: 'text', 'aws:ec2:image'
 */
const getParameter = ({ name, version, json }) => catchErrors((async () => {
	const e = (...args) => wrapErrors(`Failed to get AWS Parameter store variable '${name||''}'.`, ...args)
	if (!name)
		throw e('Missing required argument \'name\'.')

	const Name = version ? `${name}:${version}` : name
	const data = await _ssmGetParameter({ Name }).catch(err => {
		if (err.code == 'ParameterNotFound')
			return null
		throw e(err)
	})

	if (json && data && data.Parameter && data.Parameter.Value) {
		try {
			data.Parameter.Value = JSON.parse(data.Parameter.Value)
		} catch(err) {
			throw e(`Failed to JSON parse Parameter Store '${Name}'. Failed parsed value: ${data.Parameter.Value}`)
		}
	} 

	if (!data || !data.Parameter)
		return null
	else
		return Object.keys(data.Parameter).reduce((acc,key) => {
			if (key == 'ARN')
				acc.arn = data.Parameter[key]    
			else {
				const newKey = key.replace(/^./, m => (m||'').toLowerCase())
				acc[newKey] = data.Parameter[key]
			}
			return acc
		}, {})
})())

/**
 * 
 * 
 * @param  {String}		name            Required.
 * @param  {Object}		value           Required.
 * @param  {String}		type            Valid types are 'String' (default), 'StringList' and 'SecureString'    
 * @param  {String}		description 
 * @param  {Boolean}	overWrite   
 * @param  {String}		tier            'Standard' (default) | 'Advanced' | 'Intelligent-Tiering'
 * @param  {Object}		tags      
 *   
 * @return {Object}		output
 * @return {Number}			.version        
 * @return {String}			.tier        
 */
const putParameter = ({ name, type, value, description, overWrite, tags, tier }) => catchErrors((async () => {
	const e = (...args) => wrapErrors(`Failed to create/update AWS Parameter store variable '${name||''}'.`, ...args)
	if (!name)
		throw e('Missing required \'name\'.')
	if (value === undefined || value === null)
		throw e('Missing required \'value\'.')

	const t = typeof(value)
	let _value
	if (t == 'object')
		_value = value instanceof Date ? value.toISOString() : JSON.stringify(value)
	else if (t == 'number')
		_value = `${value}`
	else if (t == 'boolean')
		_value = value ? 'true' : 'false'
	else if (t == 'function')
		_value = value.toString()
	else
		_value = value

	if (!type)
		type = 'String'

	const _tags = tags && !tags.Name ? { ...tags, Name:name } : (tags||{})

	const params = {
		Name: name,
		Value: _value,
		Description: description,
		Type: type
	}

	if (typeof(overWrite) == 'boolean')
		params.Overwrite = overWrite
	if (tags)
		params.Tags = Object.entries(_tags).map(([Key, Value]) => ({ Key, Value }))
	if (tier)
		params.Tier = tier

	const data = await _ssmPutParameter(params)
	const { Version, Tier } = data || {}
	return { version:Version, tier:Tier }
})())

module.exports = {
	get: getParameter,
	put: putParameter
}
