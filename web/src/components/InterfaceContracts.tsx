import { ContractEntry } from '../types'

interface InterfaceContractsProps {
  contracts: ContractEntry[]
}

export default function InterfaceContracts({ contracts }: InterfaceContractsProps): JSX.Element {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Interface Contracts</h2>
      {contracts.length === 0 ? (
        <p className="text-sm text-gray-400 border border-gray-200 rounded-lg p-4">
          No scaffold contracts
        </p>
      ) : (
        <div className="space-y-4">
          {contracts.map((contract, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-800">{contract.name}</span>
                <span className="text-xs font-mono text-gray-500">{contract.file}</span>
              </div>
              <pre className="px-4 py-3 text-xs font-mono text-gray-700 bg-white overflow-x-auto whitespace-pre-wrap break-all">
                {contract.signature}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
