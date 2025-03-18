import { json } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { gqlRequest } from '../lib/graphql-client';

interface User {
  id: number;
  name: string;
  email: string;
}

interface History {
  id: number;
  date: string;
  clinic: string;
  result: string;
}

interface TestSet {
  id: number;
  frequency: number;
  nextDate: string;
  user: User;
  histories: History[];
}

interface TestSetsResponse {
  getAllTestSets: TestSet[];
}

export async function loader() {
  const query = `
    query {
      getAllTestSets {
        id
        frequency
        nextDate
        user {
          id
          name
          email
        }
        histories {
          id
          date
          clinic
          result
        }
      }
    }
  `;

  try {
    const data = await gqlRequest<TestSetsResponse>(query);
    return json(data);
  } catch (error) {
    console.error('Error fetching test sets:', error);
    return json({ getAllTestSets: [] });
  }
}

export default function Index() {
  const { getAllTestSets } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Health Checkup Schedule</h1>
          <Link
            to="/test-sets/new"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create New Test Set
          </Link>
        </div>
        <div className="bg-white shadow-sm rounded-lg divide-y divide-gray-200">
          {getAllTestSets.map((testSet) => (
            <div key={testSet.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    Next Checkup: {new Date(testSet.nextDate).toLocaleDateString()}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Frequency: Every {testSet.frequency} days
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{testSet.user.name}</p>
                  <p className="text-sm text-gray-500">{testSet.user.email}</p>
                </div>
              </div>

              {testSet.histories.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">History</h3>
                  <div className="bg-gray-50 rounded-md">
                    <div className="flow-root">
                      <ul className="divide-y divide-gray-200">
                        {testSet.histories.map((history) => (
                          <li key={history.id} className="px-4 py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {new Date(history.date).toLocaleDateString()}
                                </p>
                                <p className="text-sm text-gray-500">{history.clinic}</p>
                              </div>
                              <div className="text-sm">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                                  ${history.result === 'Normal' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                  {history.result}
                                </span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
