import ContactRequest from './contactRequest.model.js';
import PageView from './pageView.model.js';

export async function aggregatePageViews(pipeline = []) {
  return PageView.aggregate(pipeline);
}

export async function aggregateContactRequests(pipeline = []) {
  return ContactRequest.aggregate(pipeline);
}
