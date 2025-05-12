#!/usr/bin/env python3
"""
Test script for the enhanced semantic search implementation.
This script simulates single and multi-user search requests.
"""
import os
import sys
import json
import time
import random
import threading
import argparse
import requests
from concurrent.futures import ThreadPoolExecutor

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Sample queries for testing
SIMPLE_QUERIES = ["education", "climate", "housing", "health", "technology"]
COMPLEX_QUERIES = [
    "sustainable urban development",
    "affordable housing initiatives",
    "climate change adaptation strategies",
    "public health improvement programs",
    "technology integration in education"
]
SEMANTIC_ONLY_QUERIES = [
    "environmental protection measures",
    "equitable community resources",
    "workforce development initiatives",
    "neighborhood safety improvements",
    "digital inclusion strategies"
]

def run_search_test(base_url, query, semantic_mode="auto", timeout_ms=10000):
    """
    Run a single search test with the given parameters.

    Args:
        base_url: Base URL of the API
        query: Search query
        semantic_mode: Search mode (auto, only, no)
        timeout_ms: Client timeout in milliseconds

    Returns:
        Dictionary with test results
    """
    start_time = time.time()

    # Build the URL with proper encoding
    from urllib.parse import quote
    query_encoded = quote(query)
    url = f"{base_url}/api/search?q={query_encoded}&semantic={semantic_mode}"

    # Log the URL we're requesting
    print(f"  Testing URL: {url}")
    
    # Set headers with timeout
    headers = {
        "X-Client-Timeout": str(timeout_ms)
    }
    
    try:
        # Make the request
        response = requests.get(url, headers=headers, timeout=timeout_ms/1000)
        elapsed_time = time.time() - start_time
        
        # Process the response
        if response.status_code == 200:
            results = response.json()
            
            # Extract headers
            search_time = response.headers.get('X-Search-Time', 'unknown')
            
            return {
                "success": True,
                "query": query,
                "semantic_mode": semantic_mode,
                "result_count": len(results),
                "search_time": search_time,
                "elapsed_time": elapsed_time,
                "status_code": response.status_code
            }
        else:
            return {
                "success": False,
                "query": query,
                "semantic_mode": semantic_mode,
                "error": f"HTTP {response.status_code}",
                "elapsed_time": elapsed_time,
                "status_code": response.status_code
            }
            
    except requests.exceptions.Timeout:
        elapsed_time = time.time() - start_time
        return {
            "success": False,
            "query": query,
            "semantic_mode": semantic_mode,
            "error": "Request timed out",
            "elapsed_time": elapsed_time,
            "status_code": 0
        }
        
    except Exception as e:
        elapsed_time = time.time() - start_time
        return {
            "success": False,
            "query": query,
            "semantic_mode": semantic_mode,
            "error": str(e),
            "elapsed_time": elapsed_time,
            "status_code": 0
        }

def run_concurrent_searches(base_url, num_concurrent, query_type="mixed", semantic_mode="auto"):
    """
    Run multiple search requests concurrently.

    Args:
        base_url: Base URL of the API
        num_concurrent: Number of concurrent requests
        query_type: Type of queries to use (simple, complex, semantic, mixed)
        semantic_mode: Search mode (auto, only, no)

    Returns:
        List of result dictionaries
    """
    # Select queries based on type
    if query_type == "simple":
        queries = [random.choice(SIMPLE_QUERIES) for _ in range(num_concurrent)]
    elif query_type == "complex":
        queries = [random.choice(COMPLEX_QUERIES) for _ in range(num_concurrent)]
    elif query_type == "semantic":
        queries = [random.choice(SEMANTIC_ONLY_QUERIES) for _ in range(num_concurrent)]
    else:  # mixed
        queries = []
        for _ in range(num_concurrent):
            query_set = random.choice([SIMPLE_QUERIES, COMPLEX_QUERIES, SEMANTIC_ONLY_QUERIES])
            queries.append(random.choice(query_set))

    print(f"Running {num_concurrent} concurrent searches with {query_type} queries")

    # Run the searches concurrently
    with ThreadPoolExecutor(max_workers=num_concurrent) as executor:
        # Submit all search tasks
        futures = [
            executor.submit(run_search_test, base_url, query, semantic_mode)
            for query in queries
        ]
        
        # Wait for all tasks to complete and collect results
        results = [future.result() for future in futures]
    
    return results

def calculate_statistics(results):
    """
    Calculate statistics from a list of search results.
    
    Args:
        results: List of result dictionaries
        
    Returns:
        Dictionary with statistics
    """
    # Extract successful and failed results
    successful = [r for r in results if r["success"]]
    failed = [r for r in results if not r["success"]]
    
    # Calculate times
    if successful:
        elapsed_times = [r["elapsed_time"] for r in successful]
        elapsed_times.sort()
        
        # Calculate percentiles
        p50_idx = len(elapsed_times) // 2
        p95_idx = int(len(elapsed_times) * 0.95)
        p99_idx = int(len(elapsed_times) * 0.99)
        
        p50 = elapsed_times[p50_idx] if p50_idx < len(elapsed_times) else 0
        p95 = elapsed_times[p95_idx] if p95_idx < len(elapsed_times) else 0
        p99 = elapsed_times[p99_idx] if p99_idx < len(elapsed_times) else 0
        
        avg_time = sum(elapsed_times) / len(elapsed_times)
    else:
        p50 = p95 = p99 = avg_time = 0
    
    return {
        "total_requests": len(results),
        "successful": len(successful),
        "failed": len(failed),
        "success_rate": len(successful) / len(results) if results else 0,
        "average_time": avg_time,
        "p50": p50,
        "p95": p95,
        "p99": p99,
        "error_types": {error: len([r for r in failed if r["error"] == error]) 
                         for error in set(r["error"] for r in failed)}
    }

def display_results(stats, description):
    """Display the test results in a readable format."""
    print(f"\n=== {description} ===")
    print(f"Total requests: {stats['total_requests']}")
    print(f"Success rate: {stats['success_rate'] * 100:.1f}%")
    print(f"Average response time: {stats['average_time']:.2f}s")
    print(f"Response time percentiles:")
    print(f"  P50: {stats['p50']:.2f}s")
    print(f"  P95: {stats['p95']:.2f}s")
    print(f"  P99: {stats['p99']:.2f}s")
    
    if stats['failed'] > 0:
        print("Error types:")
        for error, count in stats['error_types'].items():
            print(f"  {error}: {count}")
    print()

def main():
    """Main test function."""
    parser = argparse.ArgumentParser(description="Test semantic search performance")
    parser.add_argument("--base-url", default="http://localhost:5000",
                        help="Base URL for the API server")
    parser.add_argument("--single", action="store_true",
                        help="Run single-user tests")
    parser.add_argument("--multi", action="store_true",
                        help="Run multi-user tests")
    parser.add_argument("--users", type=int, default=10,
                        help="Number of concurrent users for multi-user test")
    parser.add_argument("--rounds", type=int, default=3,
                        help="Number of test rounds to run")
    
    args = parser.parse_args()
    
    print("Semantic Search Performance Test")
    print("--------------------------------")
    print(f"Base URL: {args.base_url}")
    
    # Run single-user tests if requested
    if args.single or not (args.single or args.multi):
        print("\nRunning single-user tests...")
        
        # Test simple queries
        print("Testing simple keyword queries...")
        simple_results = []
        for _ in range(args.rounds):
            for query in SIMPLE_QUERIES:
                result = run_search_test(args.base_url, query)
                simple_results.append(result)
                print(f"  Query: '{query}' - {'Success' if result['success'] else 'Failed'} - Time: {result['elapsed_time']:.2f}s")
        
        # Test complex queries
        print("\nTesting complex queries...")
        complex_results = []
        for _ in range(args.rounds):
            for query in COMPLEX_QUERIES:
                result = run_search_test(args.base_url, query)
                complex_results.append(result)
                print(f"  Query: '{query}' - {'Success' if result['success'] else 'Failed'} - Time: {result['elapsed_time']:.2f}s")
        
        # Test semantic-only queries
        print("\nTesting semantic-only queries...")
        semantic_results = []
        for _ in range(args.rounds):
            for query in SEMANTIC_ONLY_QUERIES:
                result = run_search_test(args.base_url, query, semantic_mode="only")
                semantic_results.append(result)
                print(f"  Query: '{query}' - {'Success' if result['success'] else 'Failed'} - Time: {result['elapsed_time']:.2f}s")
        
        # Display statistics
        display_results(calculate_statistics(simple_results), "Simple Query Results")
        display_results(calculate_statistics(complex_results), "Complex Query Results")
        display_results(calculate_statistics(semantic_results), "Semantic-Only Query Results")
    
    # Run multi-user tests if requested
    if args.multi or not (args.single or args.multi):
        print("\nRunning multi-user tests...")
        
        # Test with different numbers of concurrent users
        for num_users in [5, args.users, args.users * 2]:
            print(f"\nTesting with {num_users} concurrent users...")
            
            # Mixed query types with auto semantic mode
            mixed_results = []
            for round_num in range(args.rounds):
                print(f"  Round {round_num + 1}/{args.rounds}...")
                round_results = run_concurrent_searches(args.base_url, num_users, "mixed", "auto")
                mixed_results.extend(round_results)
            
            # Semantic-only queries
            semantic_results = []
            for round_num in range(args.rounds):
                print(f"  Round {round_num + 1}/{args.rounds} (semantic only)...")
                round_results = run_concurrent_searches(args.base_url, num_users, "semantic", "only")
                semantic_results.extend(round_results)
            
            # Display statistics
            display_results(
                calculate_statistics(mixed_results), 
                f"Mixed Queries with {num_users} Concurrent Users"
            )
            display_results(
                calculate_statistics(semantic_results), 
                f"Semantic-Only Queries with {num_users} Concurrent Users"
            )

if __name__ == "__main__":
    main()