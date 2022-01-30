/**
 * Copyright (c) 2019-2022, Cloudless Consulting Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

module.exports = {
	cloudfront: require('./cloudfront'),
	cloudwatch: require('./cloudwatch'),
	parameterStore: require('./parameterStore'),
	resource: require('./resource'),
	s3: require('./s3')
}