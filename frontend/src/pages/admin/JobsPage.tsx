import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { api } from '../../lib/api';
import type { JobWithDetails, JobStatus, LineItem } from '@portal/shared';
import NewAddJobModal from '../../components/modals/admin/NewAddJobModal';

/**
 * REFACTORED: The React Query fetcher.
 * It now correctly awaits the JSON response. The backend already returns the
 * exact shape needed by useInfiniteQuery, including the list of jobs and pagination details.
 */
const fetchJobs = async ({ pageParam = 1, queryKey }: any) => {
	const [_key, filters] = queryKey;
	const res = await api.admin.jobs.$get({
		query: {
			page: pageParam.toString(),
			...filters,
		},
	});
	if (!res.ok) {
		throw new Error('Failed to fetch jobs');
	}
	// The backend response `{ jobs: [], totalPages: X, currentPage: Y }` is returned directly.
	return await res.json();
};

const allJobStatuses: JobStatus[] = [
	'pending',
	'upcoming',
	'payment_needed',
	'payment_overdue',
	'complete',
	'canceled',
	'quote_draft',
	'invoice_draft',
	'job_draft',
];
const jobStatuses = [...new Set(allJobStatuses)];

function JobsPage() {
	const [isImporting, setIsImporting] = useState(false);
	const [importMessage, setImportMessage] = useState<string | null>(null);
	const [isAddJobModalOpen, setIsAddJobModalOpen] = useState(false);
	const [selectedJob, setSelectedJob] = useState<JobWithDetails | null>(null);
	const [filters, setFilters] = useState({ status: '', search: '' });
	const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const { ref, inView } = useInView();

	const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
		queryKey: ['adminJobs', filters],
		queryFn: fetchJobs,
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const nextPage = lastPage.currentPage + 1;
			return nextPage <= lastPage.totalPages ? nextPage : undefined;
		},
	});

	useEffect(() => {
		if (inView && hasNextPage) {
			fetchNextPage();
		}
	}, [inView, hasNextPage, fetchNextPage]);

	const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
	};

	const handleImportFromStripe = async () => {
		setIsImporting(true);
		setImportMessage(null);
		try {
			// Assuming an import endpoint exists and returns a summary
			const response = await api.admin.jobs.import.$post({});
			const result = await response.json();
			setImportMessage(`Successfully imported ${result.importedCount} jobs.`);
			queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
		} catch (err) {
			console.error('Failed to import from Stripe:', err);
			setImportMessage('Failed to import jobs from Stripe.');
		} finally {
			setIsImporting(false);
		}
	};

	const jobs = useMemo(() => data?.pages.flatMap((page) => page.jobs) ?? [], [data]);

	return (
		<div className="container mx-auto p-4 md:p-6 lg:p-8">
			{isAddJobModalOpen && <NewAddJobModal isOpen={isAddJobModalOpen} onClose={() => setIsAddJobModalOpen(false)} onJobAdded={() => queryClient.invalidateQueries({ queryKey: ['adminJobs'] })} />}

			<div className="flex flex-wrap justify-between items-center mb-6 gap-4">
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white">All Jobs</h1>
				<div className="flex items-center space-x-2">
					<button onClick={() => setIsAddJobModalOpen(true)} className="btn btn-primary">
						Create New Job
					</button>
					<button onClick={handleImportFromStripe} className="btn btn-secondary" disabled={isImporting}>
						{isImporting ? 'Importing...' : 'Import from Stripe'}
					</button>
				</div>
			</div>

			{importMessage && <div className="alert alert-info mb-4">{importMessage}</div>}

			<div className="flex flex-wrap gap-4 mb-4">
				<input type="text" name="search" placeholder="Search by job or customer..." value={filters.search} onChange={handleFilterChange} className="input input-bordered w-full max-w-xs" />
				<select name="status" value={filters.status} onChange={handleFilterChange} className="select select-bordered w-full max-w-xs">
					<option value="">All Statuses</option>
					{jobStatuses.map((s) => (
						<option key={s} value={s}>
							{s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
						</option>
					))}
				</select>
			</div>

			<div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
				{status === 'loading' ? (
					<p className="p-4 text-center">Loading jobs...</p>
				) : status === 'error' ? (
					<p className="p-4 text-center text-red-500">Error: {error.message}</p>
				) : (
					<div className="overflow-x-auto">
						<table className="table w-full">
							<thead>
								<tr>
									<th>Customer</th>
									<th>Title</th>
									<th>Status</th>
									<th>Created</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{jobs.map((item: JobWithDetails) => (
									<React.Fragment key={item.id}>
										<tr className="hover" onClick={() => setExpandedJobId(expandedJobId === item.id ? null : item.id)}>
											<td>{item.customerName}</td>
											<td>{item.title}</td>
											<td>
												<span className={`badge badge-ghost`}>{item.status.replace(/_/g, ' ')}</span>
											</td>
											<td>{new Date(item.createdAt).toLocaleDateString()}</td>
											<td className="text-right">
												<Link to={`/admin/jobs/${item.id}`} className="btn btn-ghost btn-sm">
													Details
												</Link>
											</td>
										</tr>
										{expandedJobId === item.id && (
											<tr className="bg-gray-50 dark:bg-gray-700/20">
												<td colSpan={5} className="p-4">
													<div>
														<h4 className="font-bold mb-2">Line Items</h4>
														{item.line_items && item.line_items.length > 0 ? (
															<table className="table table-sm w-full">
																<tbody>
																	{item.line_items.map((line_item: LineItem) => (
																		<tr key={line_item.id}>
																			<td>{line_item.description}</td>
																			<td className="text-right">${((line_item.unit_total_amount_cents || 0) / 100).toFixed(2)}</td>
																		</tr>
																	))}
																</tbody>
															</table>
														) : (
															<p className="text-sm text-gray-500">No line items for this entry.</p>
														)}
													</div>
												</td>
											</tr>
										)}
									</React.Fragment>
								))}
							</tbody>
						</table>
						<div ref={ref} className="text-center p-4">
							{isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Scroll to load more' : 'Nothing more to load.'}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default JobsPage;
