/**
 * Copyright (c) 2019-2022, Cloudless Consulting Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

const { error:{ catchErrors, wrapErrors } } = require('puffy-core')
const AWS = require('aws-sdk')
const { promisify } = require('./_utils')

/**
 * Gets resources by tag. Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/ResourceGroupsTaggingAPI.html#getResources-property
 * 
 * @param  {Object}   tags							Required
 * @param  {String}   region						Required. WARNING. Certain AWS services are global (e.g., 'cloudfront'), which means their region is 'us-east-1'.		 
 * @param  {[String]} types							Optional. For example: 'ec2:instance', 'cloudfront:distribution'
 * 
 * @return {String}   output.paginationToken		
 * @return {[Object]} output.resources[]		
 * @return {String}	 .arn
 * @return {Object}	 .tags		
 */
const getResourcesByTags = ({ tags, region, types }) => catchErrors((async() => {
	const errMsg = 'Failed to get resources by tag'

	if (!tags)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'tags\'')])
	if (!region)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'region\'')])

	const keys = Object.keys(tags)
	if (!keys.length)
		return []

	const resource = _createRegionResource(region)
	const resourceTypeFilter = !types || !types.length ? {} : {
		ResourceTypeFilters: types
	}

	const [errors, resp] = await resource.getResources({
		...resourceTypeFilter,
		TagFilters: keys.map(Key => ({
			Key,
			Values:[tags[Key]]
		}))
	})

	if (errors)
		throw wrapErrors(errMsg, errors)

	const { PaginationToken, ResourceTagMappingList } = resp || {}
	return {
		paginationToken: PaginationToken,
		resources: (ResourceTagMappingList||[]).map(r => ({
			arn: r.ResourceARN,
			tags: (r.Tags||[]).reduce((acc,tag) => {
				acc[tag.Key] = tag.Value
				return acc
			}, {})
		}))
	}
})())

const _regionResources = {}
const _createRegionResource = region => {
	if (!_regionResources[region]) {
		const obj = new AWS.ResourceGroupsTaggingAPI({ apiVersion: '2017-01-26', region })
		_regionResources[region] = {
			// Doc: Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/ResourceGroupsTaggingAPI.html#getResources-property
			getResources: promisify(obj, 'getResources', true)
		}
	}

	return _regionResources[region]
}

module.exports = {
	getByTags: getResourcesByTags
}