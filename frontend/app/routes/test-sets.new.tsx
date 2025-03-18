import { json, redirect } from '@remix-run/node';
import { Form, useActionData, useLoaderData, useNavigation } from '@remix-run/react';
import { gqlRequest } from '../lib/graphql-client';

interface User {
  id: number;
  name: string;
  email: string;
}

interface Item {
  id: number;
  name: string;
  defaultFrequency: number;
}

export async function loader() {
  const query = `
    query {
      getAllUsers {
        id
        name
        email
      }
      getAllItems {
        id
        name
        defaultFrequency
      }
    }
  `;

  try {
    const data = await gqlRequest<{
      getAllUsers: User[];
      getAllItems: Item[];
    }>(query);
    return json(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    return json({ getAllUsers: [], getAllItems: [] });
  }
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const userId = formData.get('userId');
  const itemId = formData.get('itemId');
  const frequency = formData.get('frequency');
  const nextDate = formData.get('nextDate');

  const mutation = `
    mutation CreateTestSet($testSetData: TestSetInput!) {
      createTestSet(testSetData: $testSetData) {
        id
        userId
        itemId
        frequency
        nextDate
        user {
          id
          name
          email
        }
      }
    }
  `;

  try {
    const response = await gqlRequest(mutation, {
      testSetData: {
        userId: Number(userId),
        itemId: Number(itemId),
        frequency: Number(frequency),
        nextDate: nextDate,
      },
    });
    console.log('Test set created:', response);
    return redirect('/');
  } catch (error) {
    console.error('Error creating test set:', error);
    return json({ error: 'Failed to create test set. Please check the console for details.' }, { status: 400 });
  }
}

export default function NewTestSet() {
  const { getAllUsers, getAllItems } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Create New Test Set</h1>
        
        {actionData?.error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-400 rounded-md">
            <p className="text-sm text-red-700">{actionData.error}</p>
          </div>
        )}

        <div className="bg-white shadow-sm rounded-lg p-6">
          <Form method="post" className="space-y-6">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                User
              </label>
              <select
                id="userId"
                name="userId"
                required
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
              >
                <option value="">Select a user</option>
                {getAllUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="itemId" className="block text-sm font-medium text-gray-700">
                Test Item
              </label>
              <select
                id="itemId"
                name="itemId"
                required
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                onChange={(e) => {
                  const item = getAllItems.find((i) => i.id === Number(e.target.value));
                  if (item) {
                    const frequencyInput = document.getElementById('frequency') as HTMLInputElement;
                    frequencyInput.value = String(item.defaultFrequency);
                  }
                }}
              >
                <option value="">Select a test item</option>
                {getAllItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Every {item.defaultFrequency} days)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">
                Frequency (days)
              </label>
              <input
                type="number"
                id="frequency"
                name="frequency"
                required
                min="1"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="nextDate" className="block text-sm font-medium text-gray-700">
                Next Checkup Date
              </label>
              <input
                type="date"
                id="nextDate"
                name="nextDate"
                required
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </a>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? 'Creating...' : 'Create Test Set'}
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
} 