/**
 * Copyright (c) 2019-2022, Cloudless Consulting Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

const fs = require('fs')
const fg = require('fast-glob')
const { join, extname, sep, posix } = require('path')
const { createHash } = require('crypto')
const { utils: { throttle } } = require('core-async')
const mime = require('mime-types')
const { error:{ catchErrors, wrapErrors } } = require('puffy-core')
const AWS = require('aws-sdk')
const { REGION, promisify } = require('./_utils')
const s3 = new AWS.S3({ apiVersion: '2006-03-01', computeChecksums: true, region:REGION })

// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property
const _getObject = promisify(s3, 'getObject', true)
// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
const _putObject = promisify(s3, 'putObject', true)
// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listBuckets-property
const _listBuckets = promisify(s3, 'listBuckets', true)
// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createBucket-property
const _createBucket = promisify(s3, 'createBucket', true)
// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putBucketTagging-property
const _putBucketTagging = promisify(s3, 'putBucketTagging', true)
// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getBucketLocation-property
const _getBucketLocation = promisify(s3, 'getBucketLocation', true)
// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getBucketWebsite-property
const _getBucketWebsite = promisify(s3, 'getBucketWebsite', true)
// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putBucketWebsite-property
const _putBucketWebsite = promisify(s3, 'putBucketWebsite', true)
// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putBucketPolicy-property
const _putBucketPolicy = promisify(s3, 'putBucketPolicy', true)

/**
 * 
 * @param  {String}	bucket		Bucket name
 * 
 * @return {Boolean}
 */
const bucketExists = async bucket => {
	const [headErrors] = await _headBucket({ Bucket:bucket })
	return !headErrors
}

/**
 * Gets a bucket details. 
 * 
 * @param  {String}  bucket	
 * @param  {String}  options.website	Default false. Includes website details.	
 * 
 * @return {String}  region						Always returned (e.g., 'ap-southeast-2')
 * @return {String}  location					Always returned (e.g., 'http://my-bucket-name.s3.amazonaws.com/')
 * @return {String}  regionalLocation			Always returned (e.g., 'http://my-bucket-name.s3.ap-southeast-2.amazonaws.com/')
 * @return {String}  bucketDomainName			Always returned (e.g., 'my-bucket-name.s3.amazonaws.com')
 * @return {String}  bucketRegionalDomainName	Always returned (e.g., 'my-bucket-name.s3.ap-southeast-2.amazonaws.com')
 * @return {Boolean} website					Only with 'website:true'. 
 * @return {Boolean} websiteEndpoint			Only with 'website:true'. (e.g., 'http://my-bucket-name.s3-website-ap-southeast-2.amazonaws.com/')
 */
const getBucket = (bucket, options) => catchErrors((async () => {
	options = options || {}
	const errMsg = `Failed to get bucket '${bucket}' details`

	if (!bucket)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'name\'')])

	const params = {
		Bucket: bucket
	}

	const tasks = [
		// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getBucketLocation-property
		_getBucketLocation(params)
	]

	// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getBucketWebsite-property
	if (options.website)
		tasks.push(_getBucketWebsite(params).then(([errors, data]) => {
			if (errors && errors[0] && (errors[0].message||'').indexOf('does not have a website configuration') >= 0)
				return [null,{ website:false }]
			else if (errors)
				return [errors, data]
			else
				return [errors, data ? { ...data, website:true  } : data]
		}))

	const data = await Promise.all(tasks)
	const allErrors = []
	let allData = {}
	for (let i=0;i<data.length;i++) {
		const [errors, resp] = data[i]
		if (errors)
			allErrors.push(...errors)
		else if (resp)
			allData = { ...allData, ...resp }
	}

	if (allErrors.length)
		throw wrapErrors(errMsg, allErrors)

	const { LocationConstraint, ...rest } = allData

	const output = {
		region: LocationConstraint,
		location: `http://${bucket}.s3.amazonaws.com`,
		regionalLocation: `http://${bucket}.s3.${LocationConstraint}.amazonaws.com`,
		...rest
	}

	if (output.website)
		output.websiteEndpoint = `http://${bucket}.s3-website-${LocationConstraint}.amazonaws.com`

	output.bucketDomainName = new URL(output.location).hostname
	output.bucketRegionalDomainName = new URL(output.regionalLocation).hostname

	return output
})())

/**
 * Lists all the buckets in the account. Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listBuckets-property
 * 
 * @param  {Void}
 * 
 * @return {[Object]}	resp.buckets[]
 * @return {String}			.name
 * @return {Date}			.creationDate
 * @return {Object}		resp.owner
 * @return {String}			.id
 * @return {String}			.displayName
 */
const listBuckets = () => catchErrors((async () => {
	const errMsg = 'Failed to list buckets'
	const [errors, resp] = await _listBuckets({})
	if (errors)
		throw wrapErrors(errMsg, errors)

	const { Buckets, Owner } = resp || {}

	return {
		buckets: (Buckets||[]).map(b => ({ name:b.Name, creationDate:b.CreationDate })),
		owner: {
			id: (Owner||{}).ID,
			displayName: (Owner||{}).DisplayName
		}
	}
})())

/**
 * Creates a bucket. Doc: 
 * 	- Create: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createBucket-property
 * 	- Tagging: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putBucketTagging-property
 * 
 * @param  {String}		name		Required.
 * @param  {String}		acl			Default 'private'. Allowed values: 'private', 'public-read' (for website), 'public-read-write', 'authenticated-read'
 * @param  {String}		region		Default 'us-east-1'. Allowed values: 'af-south-1', 'ap-east-1', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3', 'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ca-central-1', 'cn-north-1', 'cn-northwest-1', 'EU', 'eu-central-1', 'eu-north-1', 'eu-south-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'me-south-1', 'sa-east-1', 'us-east-1' ,'us-east-2', 'us-gov-east-1', 'us-gov-west-1', 'us-west-1', 'us-west-2'
 * @param  {Object}		tags
 * 
 * @return {String}		location	e.g., 'http://<NAME>.s3.amazonaws.com/'
 */
const create = ({ name, acl, region, tags }) => catchErrors((async() => {
	const errMsg = `Failed to create bucket '${name}'`

	if (!name)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'name\'')])

	const [errors, resp] = await _createBucket({
		Bucket: name,
		ACL: acl || 'private',
		CreateBucketConfiguration: {
			LocationConstraint: region || 'us-east-1'
		}
	})

	if (errors)
		throw wrapErrors(errMsg, errors)

	if (tags) {
		const keys = Object.keys(tags)
		if (keys.length) {
			const [tagErrors] = await _putBucketTagging({
				Bucket: name,
				Tagging: {
					TagSet: keys.map(Key => ({ Key, Value:tags[Key]  }))
				}
			})

			if (tagErrors)
				throw wrapErrors(`Bucket '${name}' successfully created, but tagging it failed.`, tagErrors)
		}
	}

	return {
		location: (resp||{}).Location
	}
})())

/**
 * Configure a bucket as a website. Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putBucketWebsite-property
 * 
 * @param  {String}		bucket
 * @param  {String}		index			Default 'index.html'
 * @param  {String}		error			Optional (e.g., 'error.html')
 * @param  {Object}		redirect		Optional
 * @param  {String}			.hostname	
 * @param  {String}			.protocol	Default 'http'	
 * 				
 * @return {Void}
 */
const setWebsite = ({ bucket, index, error, redirect }) => catchErrors((async() => {
	const errMsg = `Failed to configure bucket '${bucket}' as a website`

	if (!bucket)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'bucket\'')])

	const params = {
		Bucket: bucket,
		WebsiteConfiguration: {
			IndexDocument: {
				Suffix: index || 'index.html'
			}
		}
	}

	if (error)
		params.WebsiteConfiguration.ErrorDocument = { Key:error }
	if (redirect && redirect.hostname) {
		params.WebsiteConfiguration.RedirectAllRequestsTo = {
			HostName: redirect.hostname,
			Protocol: redirect.protocol || 'http'
		}
	}

	const [errors] = await _putBucketWebsite(params)
	if (errors)
		throw wrapErrors(errMsg, errors)

	const [policyErrors] = await _putBucketPolicy({
		Bucket: bucket,
		Policy:JSON.stringify({
			Version: '2012-10-17',
			Statement: [{
				Sid: 'PublicReadGetObject',
				Effect: 'Allow',
				Principal: '*',
				Action: 's3:GetObject',
				Resource: `arn:aws:s3:::${bucket}/*`
			}]
		})
	})

	if (policyErrors)
		throw wrapErrors(`Bucket '${bucket}' successfully configured as website, but failed to have its policy updated to allow 's3:GetObject'.`, policyErrors)

	return null
})())

/**
 * 
 * @param  {Object}	input
 * @param  {String}		.bucket		
 * @param  {String}		.key
 * 		
 * @return {[type]}       [description]
 */
const getObject = input => catchErrors((async () => {
	const { bucket:Bucket, key:Key } = input || {}
	const e = (...args) => wrapErrors(`Failed to get object from bucket '${Bucket}/${Key}'.`, ...args)

	if (!Bucket)
		throw e(`Missing required argument '${Bucket}'`)
	if (!Key)
		throw e(`Missing required argument '${Key}'`)

	const [errors, resp] = await _getObject({
		Bucket,
		Key
	})

	if (errors)
		throw e(errors)

	// const {} = resp || {}
	return resp

})())

/**
 * Uploads an object in a bucket under a specific key. Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
 * 
 * @param  {Object}	input		
 * @param  {Object}		.body					
 * @param  {String}		.bucket					e.g., 'my-super-bucket'
 * @param  {String}		.key					e.g., 'assets/images/hello.jpeg'
 * @param  {String}		.contentType			e.g., 'image/jpeg'
 * @param  {String}		.cacheControl			e.g., 'max-age=172800' (full spec at https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9)
 * @param  {Number}		.contentLength
 * @param  {String}		.serverSideEncryption	e.g., 'AES256'
 * @param  {String}		.storageClass			e.g., 'STANDARD_IA'
 * @param  {String}		.tagging				e.g., 'key1=value1&key2=value2'
 * 
 * @return {Void}
 */
const putObject = input => catchErrors((async() => {
	let { body:Body, bucket:Bucket, key:Key, contentType:ContentType, cacheControl:CacheControl, contentLength:ContentLength, serverSideEncryption:ServerSideEncryption, storageClass:StorageClass, tagging:Tagging } = input || {}
	const e = (...args) => wrapErrors(`Failed to put object in S3 bucket '${Bucket}'.`, ...args)

	if (!Bucket)
		throw e('Missing required argument \'bucket\'')

	const t = typeof(Body)
	let b
	if (Body === undefined || Body === null)
		b = ''
	else if (Body instanceof Buffer || t == 'string')
		b = Body
	else if (t == 'object') {
		if (Body instanceof Date)
			b = Body.toISOString()
		else
			b = JSON.stringify(Body, null, '  ')
	} else 
		b = `${Body}` 

	if (!ContentLength)
		ContentLength = b.length

	const [errors, data] = await _putObject({
		Body: b,
		Bucket,
		Key,
		ContentType,
		CacheControl,
		ContentLength,
		ServerSideEncryption,
		StorageClass,
		Tagging
	})

	if (errors)
		throw e(errors)

	return data
})())

/**
 * Removes multiple keys from a bucket (max. 1000).
 * 
 * @param  {String}				bucket		Bucket's name
 * @param  {[String]|[Object]}	keys		e.g., ['key01', 'key02', { name:'key03', version:'123' }]
 * 
 * @return {Void}
 */
const removeObjects = ({ bucket, keys }) => catchErrors((async () => {
	const errMsg = `Failed to remove objects from S3 bucket '${bucket}'`

	if (!bucket)
		throw wrapErrors(errMsg, [new Error('Missing required \'bucket\' argument')])

	if (!keys || !keys.length)
		return

	if (keys.length > 1000)
		throw wrapErrors(errMsg, [new Error(`'S3.deleteObjects' only support a maximum of 1000 keys to be deleted at once. Current request attempts to delete ${keys.length} keys.`)])

	const [errors] = await catchErrors(_deleteObjects({
		Bucket: bucket,
		Delete: {
			Objects: keys.map(key => {
				if (typeof(key) == 'string')
					return { Key:key }
				else {
					const { name, version } = key || {}
					if (name) {
						const o = { Key:key }
						if (version)
							o.VersionId = version
						return o
					} else
						return null
				}
			}).filter(x => x)
		}
	}))

	if (errors)
		throw wrapErrors(errMsg, errors)

	return
})())

/**
 * Syncs files between you local machine (on disk, in memory or both) and an S3 bucket. Doc: 
 * 		- putObject: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
 * 		- deleteObjects: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#deleteObjects-property
 *
 * WARNING: This operation requires a the 's3:PutObject' permission. If the ACL is also set, then the 's3:PutObjectAcl'
 * permission is also required.
 * 
 * @param  {String}				bucket					Bucket name.
 * @param  {[Object]}			files[]					In memory files	
 * @param  {Buffer}					.content
 * @param  {String}					.path		
 * @param  {String}					.key
 * @param  {String}					.contentType		
 * @param  {String}					.cacheControl		
 * @param  {String}					.hash			
 * @param  {Number}					.contentLength	
 * @param  {String}				dir						Local directory with files (absolute or relative path)
 * @param  {String|[String]}	ignore					(1) Ignore patterns for files under 'dir' 
 * @param  {[Object]}			existingObjects[]		Skip uploading files that match both the key AND the hash
 * @param  {String}					.key				Bucket object key
 * @param  {String}					.hash				Bucket object hash
 * @param  {Boolean}			remove					Default false. True means all files must be removed from the bucket.
 * @param  {Boolean}			noWarning				Default false.
 * 
 * @return {Boolean}			output.updated			True means at least one file was either uploaded or deleted.
 * @return {Boolean}			output.srcFiles			All files(2) in the local file system.
 * @return {Boolean}			output.uploadedFiles	Uploaded files(2) dues to being new or having changed
 * @return {Boolean}			output.deletedFiles		Deleted files(2) are files that are in the 'existingObjects' but not in the local file system anymore.
 */
// (1) For example, to ignore the content under the node_modules folder: '**/node_modules/**'
// (2) A file object is structured as follow:
//		{String} file				Absolute file path.
//		{String} dir				Absolute folder path.	
//		{String} key				Object's key in S3
//		{String} path				Relative file path (relative to the folder).	
//		{String} hash				MD5 file hash	
//		{String} contentType		e.g., 'application/javascript; charset=utf-8' or 'image/png'
//		{Number} contentLength		File's size in bytes.	
//		{Buffer} content			Only set if 'includeContent' is set to true.
// 
const syncFiles = ({ bucket, files, dir, ignore, existingObjects, remove, noWarning }) => catchErrors((async () => {
	const errMsg = `Failed to sync files with S3 bucket '${bucket}'`
	existingObjects = existingObjects || []

	if (!bucket)
		throw wrapErrors(errMsg, [new Error('Missing required \'bucket\' argument')])

	if (!(await bucketExists(bucket))) {
		if (!noWarning)
			console.log(`WARNING: Bucket '${bucket}' does not exist (yet). Synching files aborted.`)
		return []
	}

	let _files = files && files.length ? [...files] : []

	if (dir) {
		const [fileErrors, dirFiles] = await _getFiles({ dir, includeContent:true, ignore })
		if (fileErrors)
			throw wrapErrors(errMsg, dirFiles)	
		
		_files.push(...dirFiles)
	}

	if (remove)
		_files = []

	const deletedFiles = existingObjects.reduce((acc, file) => {
		const fileExists = _files.some(f => f.key == file.key)
		if (!fileExists)
			acc.push(file)
		return acc
	}, [])

	// Uploads files
	const [srcFileErrors, srcFiles] = await uploadFiles({ bucket, files:_files, ignoreObjects:existingObjects })
	if (srcFileErrors)
		throw wrapErrors(errMsg, srcFileErrors)

	// Deletes files
	if (deletedFiles.length) {
		const [removeErrors] = await removeObjects({ bucket, keys:deletedFiles.map(f => f.key) })
		if (removeErrors)
			throw wrapErrors(errMsg, removeErrors)
	}

	const uploadedFiles = (srcFiles||[]).filter(x => !x.ignored)

	const output = {
		updated: uploadedFiles.length > 0 || deletedFiles.length > 0,
		srcFiles,
		uploadedFiles,
		deletedFiles
	}

	return output
})())

/**
 * Uploads files to an S3 bucket. Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
 * 
 * WARNING: This operation requires a the 's3:PutObject' and the 's3:ListBucket' permissions. If the ACL is also set, then the 's3:PutObjectAcl'
 * permission is also required.
 * 
 * @param  {String}				bucket					Bucket name.
 * @param  {[Object]}			files[]
 * @param  {Buffer}					.content
 * @param  {String}					.path		
 * @param  {String}					.key
 * @param  {String}					.contentType		
 * @param  {String}					.cacheControl		
 * @param  {String}					.hash			
 * @param  {Number}					.contentLength	
 * @param  {String}				dir		
 * @param  {String|[String]}	ignore					(1) Ignore patterns for files under 'dir'.
 * @param  {[Object]}			ignoreObjects[]			Skip uploading files that match both the key AND the hash
 * @param  {String}					.key				Bucket object key
 * @param  {String}					.hash				Bucket object hash
 * 
 * @return {String}				data[].file				Absolute file path.
 * @return {String}				data[].dir				Absolute folder path.
 * @return {Boolean}			data[].ignored			True means the file was not uploaded because it was in the 'ignoreObjects' list.
 * @return {String}				data[].key				Object's key in S3
 * @return {String}				data[].path				Relative file path (relative to the folder).	
 * @return {String}				data[].hash				MD5 file hash	
 * @return {String}				data[].contentType		e.g., 'application/javascript; charset=utf-8' or 'image/png'
 * @return {Number}				data[].contentLength	File's size in bytes.	
 * @return {Buffer}				data[].content			Only set if 'includeContent' is set to true.
 */
// (1) For example, to ignore the content under the node_modules folder: '**/node_modules/**'
// 
const uploadFiles = ({ bucket, files, dir, ignore, ignoreObjects }) => catchErrors((async () => {
	const errMsg = `Failed to upload files to S3 bucket '${bucket}'`
	ignoreObjects = ignoreObjects || []

	if (!bucket)
		throw wrapErrors(errMsg, [new Error('Missing required \'bucket\' argument')])

	const _files = files && files.length ? [...files] : []

	if (dir) {
		const [fileErrors, dirFiles] = await _getFiles({ dir, includeContent:true, ignore })
		if (fileErrors)
			throw wrapErrors(errMsg, dirFiles)	
		
		_files.push(...dirFiles)
	}

	if (!_files || !_files.length)
		return []


	const allErrors = []
	const objects = await throttle(_files.map((file,idx) => (async () => {
		const { content, contentType, cacheControl, hash, contentLength, key } = file || {}
		if (!key)
			allErrors.push(new Error(`Missing required 'files[${idx}].key' property`))
		if (!content)
			allErrors.push(new Error(`Missing required 'files[${idx}].content' property`))

		if (allErrors.length)
			return

		const f = { ...file, ignored:false }
		if (ignoreObjects.some(x => x.key == key && x.hash == hash)) {
			f.ignored = true
			return file
		} else {
			const [errors] = await putObject({
				body: content, 
				bucket: bucket, 
				key: key,
				contentType: contentType,
				cacheControl: cacheControl,
				contentLength: contentLength
			})

			if (errors) {
				allErrors.push(...errors)
				return
			} else
				return f
		}
	})), 10)

	if (allErrors.length)
		throw wrapErrors(errMsg, allErrors)

	return objects
})())

/**
 * Gets the difference between the local files (on disk, in memory or both) and a list of 'previousFiles'
 * 
 * @param  {[Object]}			files[]
 * @param  {Buffer}					.content
 * @param  {String}					.path		
 * @param  {String}					.key
 * @param  {String}					.contentType		
 * @param  {String}					.cacheControl		
 * @param  {String}					.hash			
 * @param  {Number}					.contentLength	
 * @param  {String}				dir		
 * @param  {String|[String]}	ignore					(1) Ignore patterns for files under 'dir' 
 * @param  {[Object]}			previousFiles[]			Skip uploading files that match both the key AND the hash
 * @param  {String}					.key				Bucket object key
 * @param  {String}					.hash				Bucket object hash
 * 
 * @return {Boolean}			output.diff				True means at least one file has either changed(or had been created) or was deleted.
 * @return {Boolean}			output.srcFiles			All files(2) in the local file system.
 * @return {Boolean}			output.unchangedFiles	(2)
 * @return {Boolean}			output.changedFiles		(2)
 * @return {Boolean}			output.deletedFiles		Deleted files(2) are files that are in the 'previousFiles' but not in the local file system anymore.
 */
// (1) For example, to ignore the content under the node_modules folder: '**/node_modules/**'
// (2) A file object is structured as follow:
//		{String} file				Absolute file path.
//		{String} dir				Absolute folder path.	
//		{String} key				Object's key in S3
//		{String} path				Relative file path (relative to the folder).	
//		{String} hash				MD5 file hash	
//		{String} contentType		e.g., 'application/javascript; charset=utf-8' or 'image/png'
//		{Number} contentLength		File's size in bytes.	
//		{Buffer} content			Only set if 'includeContent' is set to true.
// 
const getDiffFiles = ({ files, dir, ignore, previousFiles }) => catchErrors((async () => {
	const errMsg = 'Failed to get the difference between files'
	previousFiles = previousFiles || []

	const _files = files && files.length ? [...files] : []

	if (dir) {
		const [fileErrors, dirFiles] = await _getFiles({ dir, includeContent:true, ignore })
		if (fileErrors)
			throw wrapErrors(errMsg, dirFiles)	
		
		_files.push(...dirFiles)
	}

	const deletedFiles = previousFiles.reduce((acc, file) => {
		const fileExists = _files.some(f => f.key == file.key)
		if (!fileExists)
			acc.push(file)
		return acc
	}, [])

	const { unchangedFiles, changedFiles } = _files.reduce((acc, file) => {
		const { hash, key } = file || {}
		const fileHasNotChanged = previousFiles.some(x => x.key == key && x.hash == hash)
		if (fileHasNotChanged)
			acc.unchangedFiles.push(file)
		else
			acc.changedFiles.push(file)
		return acc
	}, { unchangedFiles:[], changedFiles:[] })
	
	return {
		diff: deletedFiles.length > 0 || changedFiles.length > 0,
		srcFiles: _files,
		unchangedFiles,
		changedFiles,
		deletedFiles
	}
})())

/**
 * Parses the website into the correct AWS format. Doc: https://www.pulumi.com/docs/reference/pkg/aws/s3/bucket/#bucketwebsite
 * 
 * @param  {String}   website.indexDocument						e.g., 'index.html'	
 * @param  {String}   website.errorDocument						e.g., 'error.html'
 * @param  {String}   website.redirectAllRequestsTo		
 * @param  {Object}   website.routingRules
 * @param  {Object}   website.cors	
 * @param  {Object}   website.content	
 * @param  {Object}   website.cloudfront	
 * 		
 * @return {String}   output.website.indexDocument
 * @return {String}   output.website.errorDocument
 * @param  {String}   output.website.redirectAllRequestsTo		
 * @return {Object}   output.website.routingRules		
 * @return {[Object]} output.corsRules			
 * @return {Object}   output.content	
 */
const getWebsiteProps = website => {
	if (!website)
		return {}

	if (typeof(website) == 'boolean')
		return { website:{} }

	const { cors, content, cloudfront, ...web } = website

	if (web.routingRules && typeof(web.routingRules) != 'string')
		web.routingRules = JSON.stringify(web.routingRules)

	return {
		website: web,
		corsRules: cors,
		content,
		cloudfront
	}
}


const _headBucket = (...args) => new Promise(next => {
	try {
		s3.headBucket(...args, (err, data) => err ? next([[err],null]) : next([null,data]))
	} catch(err) {
		next([[err],null])
	}
})

const _deleteObjects = (...args) => new Promise(next => {
	try {
		s3.deleteObjects(...args, (err, data) => err ? next([[err],null]) : next([null,data]))
	} catch(err) {
		next([[err],null])
	}
})

/**
 * Checks if a file or folder exists
 * 
 * @param  {String}  filePath 	Absolute or relative path to file or folder on the local machine
 * @return {Boolean}   
 */
const _fileExists = filePath => new Promise(onSuccess => fs.exists((filePath||''), yes => onSuccess(yes ? true : false)))

/**
 * Gets a file under a Google Cloud Storage's 'filePath'.
 * 
 * @param  {String}  filePath 	Absolute file path on the local machine
 * @return {Buffer}
 */
const _readFile = filePath => new Promise((onSuccess, onFailure) => fs.readFile(filePath||'', (err, data) => err ? onFailure(err) : onSuccess(data)))

//
// Gets an array of absolute file paths located under the 'folderPath', or a Channel that streams those files.
// 
// @param  {String}				folderPath			Absolute or relative path to folder
// @param  {String|[String]}	options.pattern 	Default is '*.*' which means all immediate files. To get all the files
//													use '**/*.*'. To include the hidden files, use: ['**/*.*', '**/.*/*'].
// @param  {String|[String]}	options.ignore		e.g., '**/node_modules/**'
// @param  {Channel}			options.channel		When a channel is passed, all files are streamed to that channel instead of 
// 													being returned as an array. The last file found add a specific string on 
// 													the channel to indicates that the scan is over. That string value is: 'end'.
// @return {[String]}         						If a channel is passed via 'options.channel', than the output is null and 
// 													the files are streamed to that channel.
// 													
const _listFiles = async (folderPath, options={}) => {
	folderPath = folderPath||''
	const pattern = options.pattern || '*.*'
	const ignore = options.ignore
	const channel = options.channel
	const patterns = (typeof(pattern) == 'string' ? [pattern] : pattern).map(p => join(folderPath, p))
	const opts = ignore ? { ignore:(typeof(ignore) == 'string' ? [ignore] : ignore).map(p => join(folderPath, p)) } : {}

	if (!channel)
		return await fg(patterns,opts)
	else {
		const stream = fg.stream(patterns,opts)
		stream.on('data', data => {
			channel.put(data)
		})
		stream.on('end', () => {
			channel.put('end')
			stream.destroy()
		})
		stream.on('error', err => {
			console.log(`An error happened while streaming files from ${folderPath}: ${err}`)
			stream.destroy()
		})

		return null
	}
}

//
// Gets an array of absolute file paths located under the 'folderPath', or a Channel that streams those files.
// 
// @param  {String}				folderPath			Absolute or relative path to folder
// @param  {String|[String]}	options.pattern 	Default is '*.*' which means all immediate files. To get all the files
//													use '**/*.*'. To include the hidden files, use: ['**/*.*', '**/.*/*'].
// @param  {String|[String]}	options.ignore		e.g., '**/node_modules/**'
// @param  {Channel}			options.channel		When a channel is passed, all files are streamed to that channel instead of 
// 													being returned as an array. The last file found add a specific string on 
// 													the channel to indicates that the scan is over. That string value is: 'end'.
// 													
// @return {[String]}         						If a channel is passed via 'options.channel', than the output is null and 
// 													the files are streamed to that channel.
// 		
const _getLocalFiles = (folderPath, options) => catchErrors((async () => {
	const errMsg = `Failed to list files in folder '${folderPath}'`
	options = options || {}

	if (!folderPath)
		throw wrapErrors(errMsg, [new Error('Missing required \'folderPath\' argument')])
	if (!(await _fileExists(folderPath)))
		throw wrapErrors(errMsg, [new Error(`Folder '${folderPath}' not found.`)])

	const [errors, data] = await catchErrors(_listFiles(folderPath, options))
	if (errors)
		throw wrapErrors(errMsg, errors)		
	return data || []
})())

/**
 * Gets the content type associated with a file extension. 
 *
 * @param  {String}	fileOrExt		e.g., 'json', '.md', 'file.html', 'folder/file.js'
 * 
 * @return {String}	contentType		e.g., 'application/json; charset=utf-8', 'text/x-markdown; charset=utf-8', 'text/html; charset=utf-8'
 */
const _getContentType = fileOrExt => !fileOrExt ? '' : (mime.contentType(fileOrExt) || '')

//
// Gets a flat list of all the files under a folder.
// 
// @param  {String}			dir		
// @param  {Boolean}			includeContent			Default false.
// @param  {String|[String]}	ignore					e.g., Ignore the content under the node_modules folder: '**/node_modules/**'
// 
// @return {String}			data[].file				Absolute file path.	
// @return {String}			data[].dir				Absolute folder path.	
// @return {String}			data[].path				Relative file path (relative to the folder).	
// @return {String}			data[].key				S3 key
// @return {String}			data[].hash				MD5 file hash	
// @return {String}			data[].contentType		e.g., 'application/javascript; charset=utf-8' or 'image/png'
// @return {Number}			data[].contentLength	File's size in bytes.	
// @return {Buffer}			data[].content			Only set if 'includeContent' is set to true.
//
const _getFiles = ({ dir, includeContent, ignore }) => catchErrors((async () => {
	const errMsg = `Fail to get all files in folder '${dir}'`

	const [listErrors, files] = await _getLocalFiles(dir, { pattern:'**/*.*', ignore })
	if (listErrors)
		throw wrapErrors(errMsg, listErrors)	

	if (!files || !files.length)
		return []

	const allErrors = []
	const filesData = await throttle(files.map(file => async () => {
		const [readErrors, buf] = await catchErrors(_readFile(file))
		if (readErrors) {
			allErrors.push(...readErrors)
			return null
		} else {
			const contentLength = buf ? buf.length : 0
			const content = contentLength ? buf.toString() : ''
			const hash = createHash('md5').update(content).digest('hex')
			const path = file.replace(dir,'')

			const output = {
				file,
				dir,
				path,
				key: path.split(sep).filter(x => x).join(posix.sep),
				hash,
				contentType: _getContentType(extname(file)),
				contentLength
			}

			if (includeContent)
				output.content = buf

			return output
		}
	}),10)

	if (allErrors.length)
		throw wrapErrors(errMsg, allErrors)	

	return filesData
})())

module.exports = {
	bucket: {
		'get': getBucket,
		create,
		list: listBuckets,
		exists: bucketExists,
		setWebsite
	},
	object: {
		'get': getObject,
		put: putObject,
		sync: syncFiles,
		upload: uploadFiles,
		getWebsiteProps,
		diff: getDiffFiles,
		remove: removeObjects
	}
}