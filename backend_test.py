import requests
import sys
import json
import io
from datetime import datetime

class FlowIQAPITester:
    def __init__(self, base_url="https://smart-finance-396.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, timeout=10)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    "test": name,
                    "endpoint": endpoint,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "endpoint": endpoint,
                "error": str(e)
            })
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_seed_demo_data(self):
        """Test seeding demo data"""
        return self.run_test("Seed Demo Data", "POST", "seed-demo-data", 200)

    def test_get_transactions(self):
        """Test getting transactions"""
        return self.run_test("Get Transactions", "GET", "transactions", 200)

    def test_dashboard_endpoint(self):
        """Test dashboard summary endpoint"""
        success, data = self.run_test("Dashboard Summary", "GET", "dashboard", 200)
        
        if success and data:
            # Validate dashboard data structure
            required_fields = ['total_balance', 'total_income', 'total_expenses', 'monthly_spending', 'categories', 'spending_by_month']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"⚠️  Warning: Missing fields in dashboard response: {missing_fields}")
                return False, data
            else:
                print(f"✅ Dashboard data structure is valid")
                print(f"   Balance: ${data.get('total_balance', 0)}")
                print(f"   Categories: {len(data.get('categories', {}))}")
                print(f"   Monthly data points: {len(data.get('spending_by_month', []))}")
        
        return success, data

    def test_insights_endpoint(self):
        """Test insights endpoint"""
        success, data = self.run_test("Get Insights", "GET", "insights", 200)
        
        if success and data:
            print(f"   Found {len(data)} insights")
            if data:
                insight_types = [insight.get('type') for insight in data]
                print(f"   Insight types: {set(insight_types)}")
        
        return success, data

    def test_advanced_insights_endpoint(self):
        """Test advanced insights endpoint with personality and health score"""
        success, data = self.run_test("Get Advanced Insights", "GET", "insights-advanced", 200)
        
        if success and data:
            # Validate structure
            required_fields = ['insights', 'personality', 'health_score']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"⚠️  Warning: Missing fields in advanced insights response: {missing_fields}")
                return False, data
            
            # Check insights array
            insights = data.get('insights', [])
            print(f"   Found {len(insights)} advanced insights")
            
            if insights:
                insight_types = [insight.get('type') for insight in insights]
                insight_ids = [insight.get('id') for insight in insights]
                print(f"   Insight types: {set(insight_types)}")
                print(f"   Insight IDs: {insight_ids[:3]}...")  # Show first 3
                
                # Check for specific insights mentioned in requirements
                expected_insights = [
                    'spending_trend', 'category_dominance', 'subscriptions', 
                    'cashflow_warning', 'weekend_spending', 'micro_spending', 'savings_projection'
                ]
                found_insights = [id for id in insight_ids if any(expected in id for expected in expected_insights)]
                print(f"   Expected insights found: {found_insights}")
            
            # Check personality
            personality = data.get('personality', {})
            if personality:
                print(f"   Personality type: {personality.get('type', 'unknown')}")
                print(f"   Personality label: {personality.get('label', 'N/A')}")
                print(f"   Traits count: {len(personality.get('traits', []))}")
                print(f"   Recommendations count: {len(personality.get('recommendations', []))}")
            
            # Check health score
            health_score = data.get('health_score', {})
            if health_score:
                print(f"   Health score: {health_score.get('score', 0)}/100")
                print(f"   Health grade: {health_score.get('grade', 'N/A')}")
                print(f"   Health factors count: {len(health_score.get('factors', []))}")
            
            print("✅ Advanced insights data structure is valid")
        
        return success, data

    def test_cashflow_prediction(self):
        """Test cashflow prediction endpoint"""
        success, data = self.run_test("Cashflow Prediction", "GET", "cashflow-prediction", 200)
        
        if success and data:
            required_fields = ['current_balance', 'predicted_end_balance', 'daily_average_spending', 'days_remaining', 'is_warning', 'message']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"⚠️  Warning: Missing fields in cashflow response: {missing_fields}")
                return False, data
            else:
                print(f"✅ Cashflow data structure is valid")
                print(f"   Current balance: ${data.get('current_balance', 0)}")
                print(f"   Predicted balance: ${data.get('predicted_end_balance', 0)}")
                print(f"   Warning: {data.get('is_warning', False)}")
        
        return success, data

    def test_csv_upload(self):
        """Test CSV upload endpoint"""
        # Create a sample CSV content
        csv_content = """date,amount,category,merchant
2024-01-15,-45.00,Food & Dining,Test Restaurant
2024-01-14,-12.50,Transport,Test Uber
2024-01-13,5000.00,Income,Test Salary"""
        
        # Create a file-like object
        csv_file = io.StringIO(csv_content)
        files = {'file': ('test_transactions.csv', csv_file.getvalue(), 'text/csv')}
        
        success, data = self.run_test("CSV Upload", "POST", "upload-csv", 200, files=files)
        
        if success and data:
            print(f"   Imported transactions: {data.get('count', 0)}")
        
        return success, data

    def test_create_transaction(self):
        """Test creating a single transaction"""
        transaction_data = {
            "date": "2024-01-20",
            "amount": 25.99,
            "category": "Food & Dining",
            "merchant": "Test Cafe",
            "type": "expense"
        }
        
        return self.run_test("Create Transaction", "POST", "transactions", 200, data=transaction_data)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting FlowIQ API Tests...")
        print(f"Testing against: {self.base_url}")
        
        # Test basic connectivity
        self.test_root_endpoint()
        
        # Test data seeding (this should happen first)
        self.test_seed_demo_data()
        
        # Test core endpoints
        self.test_get_transactions()
        self.test_dashboard_endpoint()
        self.test_insights_endpoint()
        self.test_advanced_insights_endpoint()  # New advanced insights test
        self.test_cashflow_prediction()
        
        # Test transaction creation
        self.test_create_transaction()
        
        # Test CSV upload
        self.test_csv_upload()
        
        # Print final results
        print(f"\n📊 Test Results:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Tests failed: {self.tests_run - self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                error_msg = test.get('error', f"Status {test.get('actual')} (expected {test.get('expected')})")
                print(f"   - {test['test']}: {error_msg}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = FlowIQAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())