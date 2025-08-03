import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { JobWithDetails, PhotoWithNotes, Note } from '@portal/shared';

const fetchJobDetails = async (jobId: string) => {
	const res = await api.admin.jobs[':job_id'].$get({ param: { job_id: jobId } });
	if (!res.ok) throw new HTTPException(res.status, { message: 'Failed to fetch job details' });
	const data = await res.json();
	return data.job;
};

const fetchPhotos = async (jobId: string) => {
	const res = await api.admin.jobs[':job_id'].photos.$get({ param: { job_id: jobId } });
	if (!res.ok) throw new HTTPException(res.status, { message: 'Failed to fetch photos' });
	const data = await res.json();
	return data.photos;
};

const fetchNotes = async (jobId: string) => {
	const res = await api.admin.jobs[':job_id'].notes.$get({ param: { job_id: jobId } });
	if (!res.ok) throw new HTTPException(res.status, { message: 'Failed to fetch notes' });
	const data = await res.json();
	return data.notes;
};

function JobDetail() {
	const { jobId } = useParams<{ jobId: string }>();
	const queryClient = useQueryClient();
	const [newNote, setNewNote] = useState('');

	const { data: job, isLoading: isLoadingJob, error: jobError } = useQuery<JobWithDetails | null, Error>({
		queryKey: ['job', jobId],
		queryFn: () => fetchJobDetails(jobId!),
		enabled: !!jobId,
	});

	const { data: photos, isLoading: isLoadingPhotos } = useQuery<PhotoWithNotes[], Error>({
		queryKey: ['photos', jobId],
		queryFn: () => fetchPhotos(jobId!),
		enabled: !!jobId,
	});

	const { data: notes, isLoading: isLoadingNotes } = useQuery<Note[], Error>({
		queryKey: ['notes', jobId],
		queryFn: () => fetchNotes(jobId!),
		enabled: !!jobId,
	});

	const addNoteMutation = useMutation({
		mutationFn: (noteContent: string) => {
			return api.admin.jobs[':job_id'].notes.$post({
				param: { job_id: jobId! },
				json: { content: noteContent },
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['notes', jobId] });
			setNewNote('');
		},
		onError: (err) => {
			console.error('Failed to add note:', err);
			alert('Could not add note.');
		}
	});

	const handleNoteSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newNote.trim()) return;
		addNoteMutation.mutate(newNote);
	};

    const uploadPhotoMutation = useMutation({
        mutationFn: (formData: FormData) => {
            return api.admin.photos.$post({ form: formData });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photos', jobId] });
        },
        onError: (err) => {
            console.error('Failed to upload photo:', err);
            alert('Photo upload failed.');
        }
    });

	const onDrop = useCallback(
		(acceptedFiles: File[]) => {
			if (acceptedFiles.length === 0 || !jobId || !job?.userId) return;
			const file = acceptedFiles[0];
			const formData = new FormData();
			formData.append('file', file);
			formData.append('job_id', jobId);
			formData.append('user_id', job.userId.toString());
            uploadPhotoMutation.mutate(formData);
		},
		[jobId, job?.userId, uploadPhotoMutation]
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        disabled: uploadPhotoMutation.isPending
    });

	if (isLoadingJob || isLoadingPhotos || isLoadingNotes) return <div className="text-center p-8">Loading job details...</div>;
	if (jobError) return <div className="alert alert-danger m-4">{jobError.message}</div>;
	if (!job) return <div className="text-center p-8">Job not found.</div>;

	return (
		<div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
			<div className="card bg-base-100 shadow-xl">
				<div className="card-body">
					<h1 className="card-title text-3xl">{job.title}</h1>
					<p><strong>Customer:</strong> {job.customerName}</p>
					<p><strong>Status:</strong> <span className="badge badge-ghost">{job.status.replace(/_/g, ' ')}</span></p>
					<p><strong>Address:</strong> {job.customerAddress}</p>
					<p><strong>Total:</strong> ${(job.totalAmountCents / 100).toFixed(2)}</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <h3 className="card-title text-xl">Line Items</h3>
						<div className="overflow-x-auto">
							<table className="table w-full">
								<tbody>
									{job.lineItems.map((item) => (
										<tr key={item.id}>
											<td>{item.description}</td>
											<td className="text-right">${(item.unitTotalAmountCents / 100).toFixed(2)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
                    </div>
				</div>

				<div className="card bg-base-100 shadow-xl">
					<div className="card-body">
                        <h3 className="card-title text-xl">Photos</h3>
						<div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-md text-center cursor-pointer ${isDragActive ? 'border-primary' : 'border-gray-300'}`}>
							<input {...getInputProps()} />
                            {uploadPhotoMutation.isPending ? <p>Uploading...</p> : <p>Drag 'n' drop photos here, or click to select</p>}
						</div>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
							{photos?.map((photo) => (
								<img key={photo.id} src={photo.url} alt="Job site" className="rounded-lg object-cover aspect-square" />
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="card bg-base-100 shadow-xl">
				<div className="card-body">
                    <h3 className="card-title text-xl">Notes</h3>
					<form onSubmit={handleNoteSubmit} className="flex gap-2 mb-4">
						<input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} className="input input-bordered w-full" placeholder="Add a new note..." />
						<button type="submit" className="btn btn-primary" disabled={addNoteMutation.isPending}>
							{addNoteMutation.isPending ? 'Adding...' : 'Add Note'}
						</button>
					</form>
					<ul className="space-y-4">
						{notes?.map((note) => (
							<li key={note.id} className="p-3 bg-base-200 rounded-md">
								<p className="text-sm">{note.content}</p>
								<small className="text-gray-500">{new Date(note.createdAt).toLocaleString()}</small>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}

export default JobDetail;
