# CLOUDLESS LABS - AWSX

This package exposes APIs that wrap the AWS SDK. Its purpose is to get started faster with the AWS SDK for the most common scenarios. The AWS SDK is also exposed to allow access to the natice APIs.

```
(test -f .npmrc || echo @cloudlesslabs:registry=https://npm.pkg.github.com/cloudlesslabs >> .npmrc) && \ 
npm i @cloudlesslabs/awsx
```

# Table of contents

> * [APIs](#apis)
>	- [Cloudfront](#cloudfront)
>		- [`cloudfront.distribution.exists`](#cloudfrontdistributionexists)
>		- [`cloudfront.distribution.select` and `cloudfront.distribution.find`](#cloudfrontdistributionselect-and-cloudfrontdistributionfind`)
>		- [`cloudfront.distribution.create`](#cloudfrontdistributioncreate)
>		- [`cloudfront.distribution.invalidate`](#cloudfrontdistributioninvalidate)
>		- [`cloudfront.distribution.update`](#cloudfrontdistributionupdate)
>	- [Cloudwatch](#cloudwatch)
>		- [`cloudwatch.logs.select`](#cloudwatchlogsselect)
>	- [Parameter Store](#parameter-store)
>		- [`parameterStore.get`](#parameterstoreget)
>		- [`parameterStore.put`](#parameterstoreput)
>	- [Resource](#resource)
>	- [S3](#s3)
>		- [`s3.bucket.exists`](#s3bucketexists)
>		- [`s3.bucket.list`](#s3bucketlist)
>		- [`s3.bucket.get`](#s3bucketget)
>		- [`s3.bucket.setWebsite`](#s3bucketsetWebsite)
>		- [`s3.object.get`](#s3bucketfilesget)
>		- [`s3.object.put`](#s3bucketfilesput)
>		- [`s3.object.upload`](#s3bucketfilesupload)
>		- [`s3.object.sync`](#s3bucketfilessync)
>		- [`s3.object.remove`](#s3bucketfilesremove)
> * [Annexes](#annexes)
>	- [Cloudfront distribution with S3 static website bucket](#cloudfront-distribution-with-s3-static-website-bucket)
>	- [Cloudfront distribution with private S3 bucket ](#cloudfront-distribution-with-private-s3-bucket)
> * [License](#license)

# APIs
## Cloudfront

For concrete examples, please refer to the [Annexes](#annexes):
- [Cloudfront distribution with S3 static website bucket](#cloudfront-distribution-with-s3-static-website-bucket)
- [Cloudfront distribution with private S3 bucket ](#cloudfront-distribution-with-private-s3-bucket)

### `cloudfront.distribution.exists`

```js
const { error: { catchErrors, wrapErrors } } = require('puffy-core')
const { cloudfront } = require('@cloudlesslabs/awsx')

const DISTRO = `my-distro-name`

const main = () => catchErrors((async () => {
	// ID exists
	const [idExistsErrors, idExists] = await cloudfront.distribution.exists({ 
		id: '12345'
	})
	if (idExistsErrors)
		throw wrapErrors(`Failed to find by ID`, idExistsErrors)
	else 
		console.log(`ID exists`)

	// Distro with tag exists
	const [tagExistsErrors, tagExists] = await cloudfront.distribution.exists({ 
		tags: { Name:DISTRO }
	})
	if (tagExistsErrors)
		throw wrapErrors(`Failed to find by ID`, tagExistsErrors)
	else 
		console.log(`Tag exists`)
```

### `cloudfront.distribution.select` and `cloudfront.distribution.find`

`find` and `select` uses the same API. `find` returns an object while `select` returns an array.

```js
const { error: { catchErrors, wrapErrors } } = require('puffy-core')
const { cloudfront } = require('@cloudlesslabs/awsx')

const DISTRO = `my-distro-name`

const main = () => catchErrors((async () => {
	// Find by ID
	const [distroErrors, distro] = await cloudfront.distribution.find({ 
		id: '12345'
	})
	if (distroErrors)
		throw wrapErrors(`Failed to find by ID`, distroErrors)
	else if (distro)
		console.log(distro)
		// {
		// 	id: 'E2WJO325O501XD',
		// 	arn: 'arn:aws:cloudfront::084126072180:distribution/E2WJO325O501XD',
		// 	domainName: 'dyoumeptyjf92.cloudfront.net',
		// 	status: 'InProgress',
		// 	lastUpdate: 2021-10-15T08:40:11.908Z,
		// 	eTag: 'E1AQWRQF1J4O48',
		// 	origin: {
		// 		domain: 'nic-today-20211015.s3.ap-southeast-2.amazonaws.com',
		// 		type: 's3'
		// 	},
		// 	aliases: [],
		// 	enabled: true
		// }
	else
		console.log(`Distro not found`)

	// Find by tag
	const [distro2Errors, distro2] = await cloudfront.distribution.find({ 
		tags: { Name:DISTRO }
	})
	if (distro2Errors)
		throw wrapErrors(`Failed to find by tag`, distro2Errors)
	else if (distro2)
		console.log(distro2)
		// {
		// 	id: 'E2WJO325O501XD',
		// 	arn: 'arn:aws:cloudfront::084126072180:distribution/E2WJO325O501XD',
		// 	domainName: 'dyoumeptyjf92.cloudfront.net',
		// 	status: 'InProgress',
		// 	lastUpdate: 2021-10-15T08:40:11.908Z,
		// 	eTag: 'E1AQWRQF1J4O48',
		// 	origin: {
		// 		domain: 'nic-today-20211015.s3.ap-southeast-2.amazonaws.com',
		// 		type: 's3'
		// 	},
		// 	aliases: [],
		// 	enabled: true
		// }
	else
		console.log(`Distro not found`)
```

### `cloudfront.distribution.create`

```js
const { error: { catchErrors, wrapErrors } } = require('puffy-core')
const { cloudfront } = require('@cloudlesslabs/awsx')

const DISTRO = `my-distro-name`

const main = () => catchErrors((async () => {
	const [distroErrors, distro] = await cloudfront.distribution.create({
		name: DISTRO,
		domain: 'my-bucket-website.s3.ap-southeast-2.amazonaws.com',
		operationId: '123456', 
		enabled: true,
		tags: { 
			Project:'Demo', 
			Env:'Dev',
			Name: DISTRO
		}
	})

	if (distroErrors)
		throw wrapErrors(`Distro creation failed`, distroErrors)

	console.log(distro)
	// {
	// 	id: 'E2WJO325O501XD',
	// 	arn: 'arn:aws:cloudfront::084126072180:distribution/E2WJO325O501XD',
	// 	status: 'InProgress'.
	// 	domain: 'dyoumeptyjf92.cloudfront.net'
	// }
```

### `cloudfront.distribution.invalidate`

```js
const { error: { catchErrors, wrapErrors } } = require('puffy-core')
const { cloudfront } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	// Invalidate all paths
	const [invalidationErrors, invalidation] = await cloudfront.distribution.invalidate({ 
		id: 'E2WJO325O501XD', 
		operationId: `${Date.now()}`, 
		paths: ['/*']
	})
	if (invalidationErrors)
		throw wrapErrors(`Failed to invalidate distro`, invalidationErrors) 

	console.log('Distro invalidation started')
	console.log(invalidation)
	// {
	// 	location: 'https://cloudfront.amazonaws.com/2019-03-26/distribution/E3ICGTU0Z3IYAZ/invalidation/IGLGGAGD9PT2X',
	// 	invalidation: {
	// 		id: 'IGLGGAGD9PT2X',
	// 		status: 'InProgress',
	// 		createTime: 2021-10-16T04:14:34.514Z,
	// 		paths: [ '/*' ],
	// 		operationId: '1634357673513'
	// 	}
	// }
```

### `cloudfront.distribution.update`

```js
const { error: { catchErrors, wrapErrors } } = require('puffy-core')
const { cloudfront } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	// Invalidate all paths
	const [updateErrors, results] = await cloudfront.distribution.update({ 
		id:'E2WJO325O501XD', 
		// tags: { Name:'my-distro' } // find by tags
		config: { // Update
			domain:bucketWeb01.bucketRegionalDomainName
		} 
	})
	if (updateErrors)
		throw wrapErrors('Failed to update distro', updateErrors) 

	console.log('Distro update successfull')
	console.log(results)
	// {
	// 	updateOccured: true, // False means that the last config is the same is the new, meaning there was no need for an update.
	// 	config: {
	// 		... 
	// 	}
	// }
```

## Cloudwatch
### `cloudwatch.logs.select`

```js
const { error: { catchErrors, wrapErrors } } = require('puffy-core')
const { cloudwatch } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	// Invalidate all paths
	const [updateErrors, results] = await cloudwatch.logs.select({ 
		where: {
			logGroup: '/aws/lambda/some-log-group',
			timeRange: {
				last: {
					value: 3,
					unit: 'hour'
				},
				// startDateUTC: '2022-01-01',
				// endDateUTC: '2022-01-04'
			}
		},
		// limit: 1000, // default 10,000
		all: true // Default false. True means that it keeps querying data until it gets it all (one request returns max 10K records or 1MB worth of data`)
	})
	if (updateErrors)
		throw wrapErrors('Failed to get logs', updateErrors) 

	console.log('Logs acquired successfully')
	console.log(results)
	// {
 	//		count: 120,
 	//		events: [{
 	//			logStreamName: 'dwdw',
 	//			timestamp: 2022-01-29T07:38:10.053Z,		// UTC time when the log was recorded			
 	//			message: 'ewdew',
 	//			ingestionTime: 2022-01-29T07:38:10.053Z,	// UTC time when the log added to CloudWatch
 	//			eventId: '123544454'
 	//		},
 	//		iteration: 1,									//Nb. of API requests to get all the data. (max. 100).
 	//		message: null,									// Warning message if max iteration reached.
 	//		nextToken: null
 	// }
```

## Parameter Store
### `parameterStore.get`

```js
const { parameterStore } = require('@cloudlesslabs/awsx')

parameterStore.get({
	name: 'my-parameter-store-name',
	version: 2, // Optional. If not defined, the latest version is used.
	json: true // Optional. Default false.
}).then(([errors, resp]) => console.log(resp))
// {
// 	name: 'my-parameter-store-name',
// 	type: 'String',
// 	value: {
// 		hello: 'World'
// 	},
// 	version: 2,
// 	lastModifiedDate: 2022-01-30T07:25:07.516Z,
// 	arn: 'arn:....',
// 	dataType: 'text'
// }
```

To use this API, the following policy must be attached to the hosting environmnet's IAM role:

```js
{
	Version: '2012-10-17',
	Statement: [{
		Action: [
			'ssm:GetParameter'
		],
		Resource: '*',
		Effect: 'Allow'
	}]
}
```

### `parameterStore.put`

```js
const { parameterStore } = require('@cloudlesslabs/awsx')

parameterStore.put({
	name: 'my-parameter-store-name'
	value: {
		hello: 'World'
	},
	// description: 'dewde'
	overWrite: 'dewde'
	// tier: 'Advanced', // 'Standard' (default) | 'Advanced' | 'Intelligent-Tiering'
	tags: {
		Name: 'hello'
	}
}).then(([errors, resp]) => console.log(resp))
// {
// 	version: 1,
// 	tier: 'Standard'
// }
```

## Resource

> __WARNING__: Certain AWS services are global (e.g., 'cloudfront'), which means their region is 'us-east-1'. 		

```js
const { error: { catchErrors, mergeErrors } } = require('puffy-core')
const { resource } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	const [resourceErrors, resources] = await resource.getByTags({ 
		tags: { // required
			Name:'my-resource-name' 
		}, 
		region: 'us-east-1', // required
		types: ['cloudfront:distribution'] // optional
	})
	if (resourceErrors)
		throw wrapErrors(`Failed to get resource by tag`, resourceErrors)

	console.log(resources)
	// {
	// 	paginationToken: '',
	// 	resources:[{
	// 		arn: 'arn:aws:cloudfront::1234567:distribution/SHWHSW3213',
	// 		tags: {
	// 			Name:'my-resource-name'
	// 		}
	// 	}]
	// }
})())

main().then(([errors]) => {
	if (errors)
		console.error(mergeErrors(errors).stack)
	else
		console.log('All good')
})
```

## S3

For concrete examples, please refer to the [Annexes](#annexes):
- [Cloudfront distribution with S3 static website bucket](#cloudfront-distribution-with-s3-static-website-bucket)
- [Cloudfront distribution with private S3 bucket ](#cloudfront-distribution-with-private-s3-bucket)

### `s3.bucket.exists`

```js
const { error: { catchErrors, mergeErrors } } = require('puffy-core')
const { s3 } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	const bucketName = 'some-bucket-name'
	const bucketExists = await s3.bucket.exists(bucketName)
	console.log(`Bucket '${bucketName} ${bucketExists ? ' ' : 'does not '}exist'`)
})())

main().then(([errors]) => {
	if (errors)
		console.error(mergeErrors(errors).stack)
	else
		console.log('All good')
})
```

### `s3.bucket.list`

```js
const { error: { catchErrors, wrapErrors, mergeErrors } } = require('puffy-core')
const { s3 } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	const [errors, bucketList] = await s3.bucket.list()
	if (errors)
		throw wrapErrors('Failed to list buckets', errors)
	else {
		console.log(`Found ${bucketList.buckets.length} buckets.`)
		console.log(bucketList.owner)
		if (bucketList.buckets.length) {
			console.log('First bucket')
			console.log(bucketList.buckets[0].name)
			console.log(bucketList.buckets[0].creationDate)
		}
	}
})())

main().then(([errors]) => {
	if (errors)
		console.error(mergeErrors(errors).stack)
	else
		console.log('All good')
})
```

### `s3.bucket.get`

```js
const { error: { catchErrors, wrapErrors, mergeErrors } } = require('puffy-core')
const { s3 } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	const bucketName = 'some-bucket-name'
	const [errors, bucket] = await s3.bucket.get(bucketName, { website:true })
	if (errors)
		throw wrapErrors('Failed to get bucket', errors)
	else {
		console.log(bucket)
		// {
		// 		region: 'ap-southeast-2',
		// 		location: 'http://some-bucket-name.s3.amazonaws.com/'
		// 		regionalLocation: 'http://some-bucket-name.s3.ap-southeast-2.amazonaws.com/',
		// 		bucketDomainName: 'some-bucket-name.s3.amazonaws.com'
		// 		bucketRegionalDomainName: 'some-bucket-name.s3.ap-southeast-2.amazonaws.com',
		// 		website: true, // Only with 'options.website:true'
		// 		websiteEndpoint: 'http://some-bucket-name.s3-website-ap-southeast-2.amazonaws.com' // Only with 'options.website:true'
		// }
	}
}
})())

main().then(([errors]) => {
	if (errors)
		console.error(mergeErrors(errors).stack)
	else
		console.log('All good')
})
```

### `s3.bucket.setWebsite`

```js
const { error: { catchErrors, wrapErrors, mergeErrors } } = require('puffy-core')
const { s3 } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	const bucketName = 'some-bucket-name'
	const [errors] = await s3.bucket.setWebsite({ 
		bucket: bucketName, 
		index: 'home.html', // default 'index.html'
		error: 'error.html'
	})
	if (errors)
		throw wrapErrors('Failed to get bucket', errors)
	else {
		console.log(`Bucket set as website`)
	}
}
})())

main().then(([errors]) => {
	if (errors)
		console.error(mergeErrors(errors).stack)
	else
		console.log('All good')
})
```

### `s3.object.get`

```js
const { error: { catchErrors, wrapErrors, mergeErrors } } = require('puffy-core')
const { join } = require('path')
const { s3 } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	const [errors, data] = await s3.object.get({
		bucket: 'my-bucket-name',
		key: 'path/to/my-folder/example.json',
		type: 'json' // valid values: 'buffer' (default), 'json', 'text'
	})

	if (errors)
		throw wrapErrors('Failed to content to bucket', errors)

	console.log(data)
	// {
	// 	acceptRanges: 'bytes',
	// 	lastModified: 2022-01-30T09:52:30.000Z,
	// 	contentLength: 22,
	// 	eTag: '"add7403b95c4164509110b1eac281ae6"',
	// 	contentType: 'application/json',
	// 	metadata: {},
	// 	body: {
	// 		hello: 'World'
	// 	}
	// }
}
})())

main().then(([errors]) => {
	if (errors)
		console.error(mergeErrors(errors).stack)
	else
		console.log('All good')
})
```

### `s3.object.put`

```js
const { error: { catchErrors, wrapErrors, mergeErrors } } = require('puffy-core')
const { join } = require('path')
const { s3 } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	const [errors, data] = await s3.object.put({
		body: {
			hello: 'world'
		},
		bucket: 'my-bucket-name',
		key: 'path/to/my-folder/example.json'
	})

	if (errors)
		throw wrapErrors('Failed to content to bucket', errors)

	console.log(data)
	// {
	// 	etag: '"add7403b95c4164509110b1eac281ae6"'
	// }
}
})())

main().then(([errors]) => {
	if (errors)
		console.error(mergeErrors(errors).stack)
	else
		console.log('All good')
})
```

### `s3.object.upload`

```js
const { error: { catchErrors, wrapErrors, mergeErrors } } = require('puffy-core')
const { join } = require('path')
const { s3 } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	const [uploadErrors, filesInDir] = await s3.object.upload({ 
		bucket: 'my-super-bucket', 
		dir: join(__dirname, './app'), 
		ignore: '**/node_modules/**', 
		ignoreObjects:[{ key:'src/bundle.js', hash:'123456' }], // If 'src/bundle.js' has not changed (i.e., its hash is the same), then don't upload it
		noWarning: true
	})
	if (uploadErrors)
		throw wrapErrors('Failed to upload files to bucket', uploadErrors)
	else {
		console.log(`${filesInDir.length} files in directory`)
		console.log(filesInDir[0].key)
		console.log(filesInDir[0].hash)
	}
}
})())

main().then(([errors]) => {
	if (errors)
		console.error(mergeErrors(errors).stack)
	else
		console.log('All good')
})
```

### `s3.object.sync`

Does the same as 'upload' but with the ability to delete files that have been removed locally.

```js
const { error: { catchErrors, wrapErrors, mergeErrors } } = require('puffy-core')
const { join } = require('path')
const { s3 } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	const [syncErrors, synchedData] = await s3.object.sync({ 
		bucket: 'my-super-bucket', 
		dir: join(__dirname, './app'), 
		ignore: '**/node_modules/**', 
		ignoreObjects:[{ key:'src/bundle.js', hash:'123456' }], // If 'src/bundle.js' has not changed (i.e., its hash is the same), then don't upload it
		noWarning: true
	})
	if (syncErrors)
		throw wrapErrors('Failed to sync files to bucket', syncErrors)
	else {
		console.log(synchedData)
		// {
		// 	updated: true, // True means at least one file was either uploaded or deleted.
		// 	srcFiles:[{
		// 		file: '/Users/you/Documents/my-app/bundle.js',
		// 		dir: '/Users/you/Documents/my-app/',
		// 		key: 'bundle.js',
		// 		path: '/bundle.js',
		// 		hash: '32132313213123321313',
		// 		contentType: 'application/javascript',
		// 		contentLength: '12345',
		// 		content: 'dewdwedewdeewdedewdedewdedewdeew...',
		// 	}],
		// 	uploadedFiles:[{
		// 		file: '/Users/you/Documents/my-app/bundle.js',
		// 		dir: '/Users/you/Documents/my-app/',
		// 		key: 'bundle.js',
		// 		path: '/bundle.js',
		// 		hash: '32132313213123321313',
		// 		contentType: 'application/javascript',
		// 		contentLength: '12345',
		// 		content: 'dewdwedewdeewdedewdedewdedewdeew...',
		// 	}],
		// 	deletedFiles:[]
		// }
	}
}
})())

main().then(([errors]) => {
	if (errors)
		console.error(mergeErrors(errors).stack)
	else
		console.log('All good')
})
```

### `s3.object.remove`

```js
const { error: { catchErrors, wrapErrors, mergeErrors } } = require('puffy-core')
const { s3 } = require('@cloudlesslabs/awsx')

const main = () => catchErrors((async () => {
	const [rmErrors] = await s3.object.remove({ 
		bucket: 'my-super-bucket', 
		keys:[
			'src/bundle.js',
			'src/bundle.map.js'
		]
	})
	if (rmErrors)
		throw wrapErrors('Failed to remove files from bucket', rmErrors)
	else
		console.log(`Files removed`)
}
})())

main().then(([errors]) => {
	if (errors)
		console.error(mergeErrors(errors).stack)
	else
		console.log('All good')
})
```

# Annexes
## Cloudfront distribution with S3 static website bucket

The 2 APIs in the code below are:
- `cloudfront.distribution.exists`
- `cloudfront.distribution.create`

Notice that the only way to use `cloudfront.distribution.exists` with another predicate than the Cloudfront distribution ID is with tagging. This means that the distro MUST be tagged. 

```js
const { error: { catchErrors, wrapErrors, mergeErrors } } = require('puffy-core')
const { join } = require('path')
const { s3, cloudfront, resource } = require('@cloudlesslabs/awsx')

const BUCKET = 'nic-today-20211015'
const DISTRO = `${BUCKET}-distro`
const REGION = 'ap-southeast-2'

const main = () => catchErrors((async () => {
	// 1.Making sure the bucket exists
	if (!(await s3.bucket.exists(BUCKET))) {
		console.log(`Creating bucket '${BUCKET}'...`)
		const [createErrors, newBucket] = await s3.bucket.create({ 
			name: BUCKET, 
			acl: 'public-read',  // Default 'private'
			region: REGION, // default: 'us-east-1' 
			tags: { 
				Project:'Demo', 
				Env:'Dev' 
			}
		})

		if (createErrors)
			throw wrapErrors(`Bucket creation failed`, createErrors)

		console.log(`Bucket '${BUCKET}' successfully created.`)
	} else
		console.log(`Bucket '${BUCKET}' already exists.`)

	const [getErrors, bucketDetails] = await s3.bucket.get(BUCKET, { website:true })
	if (getErrors)
		throw wrapErrors(`Bucket info failed`, getErrors)

	// 2. Making sure the website is set as a website
	if (!bucketDetails.website) {
		console.log(`Setting bucket '${BUCKET}' to website`)
		const [websiteErrors] = await s3.bucket.setWebsite({ bucket:BUCKET })
		if (websiteErrors)
			throw wrapErrors(`Failed to set bucket as website`, websiteErrors)
	} else
		console.log(`Bucket '${BUCKET}' already set to website`)

	// 3. Uploading files to the bucket
	const [syncErrors] = await s3.object.sync({
		bucket: BUCKET, 
		dir: join(__dirname, './demo'), 
		noWarning: true
	})

	if (syncErrors)
		throw wrapErrors(`Synching files failed`, syncErrors)

	// 4. Adding a cloudfront distro on the bucket
	const [distroExistsErrors, distroExists] = await cloudfront.distribution.exists({ 
		tags: { Name:DISTRO }
	})
	if (distroExistsErrors)
		throw wrapErrors(`Failed to confirm whether the distro exists or not`, distroExistsErrors)

	if (!distroExists) {
		console.log(`Creating new distro tagged 'Name:${DISTRO}' for bucket '${BUCKET}'`)
		const [distroErrors, distro] = await cloudfront.distribution.create({
			name: DISTRO,
			domain: bucketDetails.bucketRegionalDomainName,
			operationId: DISTRO, 
			enabled: true,
			tags: { 
				Project:'Demo', 
				Env:'Dev',
				Name: DISTRO
			}
		})

		if (distroErrors)
			throw wrapErrors(`Distro creation failed`, distroErrors)

		console.log(`Distro successfully created`)
		console.log(distro)
	} else
		console.log(`Distro tagged 'Name:${DISTRO}' already exist`)
})())

main().then(([errors]) => {
	if (errors)
		console.error(mergeErrors(errors).stack)
	else
		console.log('All good')
})
```

## Cloudfront distribution with private S3 bucket 

# License
BSD 3-Clause License

Copyright (c) 2019-2022, Cloudless Consulting Pty Ltd
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
