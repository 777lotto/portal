import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { useDebounce } from 'use-debounce';
import { api } from '../../lib/api';
import type { JobWithDetails, JobStatus, LineItem } from '@portal/shared';
import NewAddJobModal from '../../components/modals/admin/NewAddJobModal';
import { HTTPException } from 'hono/http-exception';

// The React Query fetcher function for retrieving jobs.
const fetchJobs = async ({ pageParam = 1, queryKey }: { pageParam: number, queryKey: (string | object)[] }) => {
	const [_key, filters] = queryKey;
	const res = await api.admin.jobs.$get({
		query: {
			page: pageParam.toString(),
			...(filters as object),
		},
	});
	if (!res.ok) {
		throw new Error('Failed to fetch jobs');
	}
	return res.json();
};

// A unique, ordered list of all possible job statuses for the filter dropdown.
const jobStatuses: JobStatus[] = [
	'pending', 'upcoming', 'payment_needed', 'payment_overdue', 'complete', 'canceled',
	'quote_draft', 'invoice_draft', 'job_draft', 'quote_sent', 'scheduled', 'invoiced', 'draft'
];

function JobsPage() {
	const [isAddJobModalOpen, setIsAddJobModalOpen] = useState(false);
	const [filters, setFilters] = useState({ status: '', search: '' });
	const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
	const [debouncedSearch] = useDebounce(filters.search, 300);

	const queryClient = useQueryClient();
	const { ref, inView } = useInView();

	// The query filters now include the debounced search term.
	const queryFilters = useMemo(() => ({
		status: filters.status,
		search: debouncedSearch,
	}), [filters.status, debouncedSearch]);


	const { data, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, status } = useInfiniteQuery({
		queryKey: ['adminJobs', queryFilters],
		queryFn: fetchJobs,
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const nextPage = lastPage.currentPage + 1;
			return nextPage <= lastPage.totalPages ? nextPage : undefined;
		},
	});

	// Automatically fetch the next page when the trigger element is in view.
	useEffect(() => {
		if (inView && hasNextPage && !isFetching) {
			fetchNextPage();
		}
	}, [inView, hasNextPage, fetchNextPage, isFetching]);

	const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
	};

    // REFACTORED: Use useMutation for the Stripe import logic.
	const importMutation = useMutation({
        mutationFn: () => {
            // CORRECTED: The API endpoint for importing invoices as jobs.
            return api.admin.invoices.import.$post({});
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
            // You can optionally show a success message from the response `res`.
        },
        onError: (err: Error) => {
            console.error('Failed to import from Stripe:', err);
            // You can show a more detailed error message to the user.
        }
    });

	const jobs = useMemo(() => data?.pages.flatMap((page) => page.jobs) ?? [], [data]);

	return (
		<div className="container mx-auto p-4 md:p-6 lg:p-8">
			{isAddJobModalOpen && <NewAddJobModal isOpen={isAddJobModalOpen} onClose={() => setIsAddJobModalOpen(false)} onJobAdded={() => queryClient.invalidateQueries({ queryKey: ['adminJobs'] })} />}

			<div className="flex flex-wrap justify-between items-center mb-6 gap-4">
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white">All Jobs</h1>
				<div className="flex items-center space-x-2">
					<button onClick={() => setIsAddJobModalOpen(true)} className="btn btn-primary">Create New Job</button>
					<button onClick={() => importMutation.mutate()} className="btn btn-secondary" disabled={importMutation.isPending}>
						{importMutation.isPending ? 'Importing...' : 'Import from Stripe'}
					</button>
				</div>
			</div>

			{importMutation.isSuccess && <div className="alert alert-success mb-4">Import completed successfully!</div>}
            {importMutation.isError && <div className="alert alert-error mb-4">Failed to import jobs from Stripe.</div>}


			<div className="flex flex-wrap gap-4 mb-4">
				<input type="text" name="search" placeholder="Search by job or customer..." value={filters.search} onChange={handleFilterChange} className="input input-bordered w-full max-w-xs" />
				<select name="status" value={filters.status} onChange={handleFilterChange} className="select select-bordered w-full max-w-xs">
					<option value="">All Statuses</option>
					{jobStatuses.map((s) => (
						<option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</option>
					))}
				</select>
			</div>

			<div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
				{status === 'pending' ? (
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
										<tr className="hover cursor-pointer" onClick={() => setExpandedJobId(expandedJobId === item.id ? null : item.id)}>
											<td>{item.customerName}</td>
											<td>{item.title}</td>
											<td><span className={`badge badge-ghost`}>{item.status.replace(/_/g, ' ')}</span></td>
											<td>{new Date(item.createdAt).toLocaleDateString()}</td>
											<td className="text-right">
												<Link to={`/admin/jobs/${item.id}`} className="btn btn-ghost btn-sm" onClick={(e) => e.stopPropagation()}>Details</Link>
											</td>
										</tr>
										{expandedJobId === item.id && (
											<tr className="bg-gray-50 dark:bg-gray-700/20">
												<td colSpan={5} className="p-4">
													<div>
														<h4 className="font-bold mb-2">Line Items</h4>
														{item.lineItems && item.lineItems.length > 0 ? (
															<table className="table table-sm w-full">
																<tbody>
																	{item.lineItems.map((line_item: LineItem) => (
																		<tr key={line_item.id}>
																			<td>{line_item.description}</td>
																			<td className="text-right">${((line_item.unitTotalAmountCents || 0) / 100).toFixed(2)}</td>
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
						<div ref={ref} className="text-center p-4 h-10">
							{isFetchingNextPage ? 'Loading more...' : hasNextPage ? '' : 'Nothing more to load.'}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default JobsPage;
