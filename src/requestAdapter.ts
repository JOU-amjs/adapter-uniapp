/// <reference path="../node_modules/@dcloudio/types/uni-app/uni/legacy/uni.d.ts" />
import { AlovaRequestAdapter, Arg, ProgressUpdater } from 'alova';
import { UniappRequestAdapter } from '../typings';
import { isPlainObject, noop } from './helper';

/**
 * Uniapp请求适配器
 */
const requestAdapter: UniappRequestAdapter = (elements, method) => {
	const { url, data, type, headers: header } = elements;
	let taskInstance: UniApp.RequestTask | UniApp.UploadTask | UniApp.DownloadTask;
	let onDownload: ReturnType<AlovaRequestAdapter<any, any, any, any, any>>['onDownload'] = noop,
		onUpload: ReturnType<AlovaRequestAdapter<any, any, any, any, any>>['onUpload'] = noop;

	const responsePromise = new Promise<
		| UniNamespace.RequestSuccessCallbackResult
		| UniNamespace.UploadFileSuccessCallbackResult
		| UniNamespace.DownloadSuccessData
	>((resolve, reject) => {
		const { config: adapterConfig } = method;
		const { requestType, timeout } = adapterConfig;
		if (requestType === 'upload') {
			const formData = {} as Arg;
			const fileData = {} as Arg;
			if (isPlainObject(data)) {
				Object.keys(data).forEach(key => {
					if (['name', 'files', 'file', 'filePath'].includes(key)) {
						fileData[key] = data[key as keyof typeof data];
					} else {
						formData[key] = data[key as keyof typeof data];
					}
				});
			}

			// 上传文件
			const uploadTask = (taskInstance = uni.uploadFile({
				...adapterConfig,
				...fileData,
				name: fileData.name,
				url,
				header,
				formData,
				timeout,
				success: res => resolve(res),
				fail: reason => reject(new Error(reason.errMsg)),
				complete: noop
			}));

			// 监听上传进度
			onUpload = (handler: ProgressUpdater) => {
				uploadTask.onProgressUpdate(({ totalBytesSent, totalBytesExpectedToSend }) => {
					handler(totalBytesExpectedToSend, totalBytesSent);
				});
			};
		} else if (requestType === 'download') {
			// 下载文件
			const downloadTask = (taskInstance = uni.downloadFile({
				...adapterConfig,
				url,
				header,
				timeout,
				success: res => resolve(res),
				fail: reason => reject(new Error(reason.errMsg)),
				complete: noop
			}));

			// 监听下载进度
			onDownload = (handler: ProgressUpdater) => {
				downloadTask.onProgressUpdate(({ totalBytesWritten, totalBytesExpectedToWrite }) => {
					handler(totalBytesExpectedToWrite, totalBytesWritten);
				});
			};
		} else {
			// 发送普通请求
			taskInstance = uni.request({
				...adapterConfig,
				url,
				data,
				header,
				method: type as any,
				timeout,
				success: res => resolve(res),
				fail: reason => reject(new Error(reason.errMsg))
			});
		}
	});

	return {
		response: () => responsePromise,
		headers: () => responsePromise.then(res => (res as UniNamespace.RequestSuccessCallbackResult).header || {}),
		abort: () => {
			taskInstance.abort();
		},
		onDownload,
		onUpload
	};
};

export default requestAdapter;
