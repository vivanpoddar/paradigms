#!/bin/bash

# Script to list all long-running Document AI operations
# Based on the configuration from your nparse route

# Configuration from your route.ts file
PROJECT_ID="39073705270"
LOCATION="us"
PROCESSOR_ID="83aeafbc915376ac"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Listing Document AI Long-Running Operations${NC}"
echo -e "${BLUE}Project ID: ${PROJECT_ID}${NC}"
echo -e "${BLUE}Location: ${LOCATION}${NC}"
echo -e "${BLUE}Processor ID: ${PROCESSOR_ID}${NC}"
echo ""

# Function to check if gcloud is authenticated
check_auth() {
    if ! gcloud auth print-access-token >/dev/null 2>&1; then
        echo -e "${RED}❌ Error: Not authenticated with gcloud${NC}"
        echo -e "${YELLOW}Please run: gcloud auth login${NC}"
        exit 1
    fi
}

# Function to list all operations
list_all_operations() {
    echo -e "${YELLOW}📋 All Long-Running Operations:${NC}"
    curl -s -X GET \
         -H "Authorization: Bearer $(gcloud auth print-access-token)" \
         "https://${LOCATION}-documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/operations" | \
    jq -r '.operations[] | "Name: \(.name) | Status: \(.metadata.state // "UNKNOWN") | Created: \(.metadata.createTime // "N/A")"' 2>/dev/null || \
    curl -s -X GET \
         -H "Authorization: Bearer $(gcloud auth print-access-token)" \
         "https://${LOCATION}-documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/operations"
    echo ""
}

# Function to list batch processing operations specifically
list_batch_operations() {
    echo -e "${YELLOW}🔄 Batch Processing Operations:${NC}"
    curl -s -X GET \
         -H "Authorization: Bearer $(gcloud auth print-access-token)" \
         "https://${LOCATION}-documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/operations?filter=type=BATCH_PROCESS_DOCUMENTS" | \
    jq -r '.operations[] | "Name: \(.name) | Status: \(.metadata.state // "UNKNOWN") | Created: \(.metadata.createTime // "N/A") | Progress: \(.metadata.progressPercent // 0)%"' 2>/dev/null || \
    curl -s -X GET \
         -H "Authorization: Bearer $(gcloud auth print-access-token)" \
         "https://${LOCATION}-documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/operations?filter=type=BATCH_PROCESS_DOCUMENTS"
    echo ""
}

# Function to list running operations only
list_running_operations() {
    echo -e "${YELLOW}⏳ Currently Running Operations:${NC}"
    curl -s -X GET \
         -H "Authorization: Bearer $(gcloud auth print-access-token)" \
         "https://${LOCATION}-documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/operations?filter=done=false" | \
    jq -r '.operations[] | "Name: \(.name) | Status: \(.metadata.state // "RUNNING") | Created: \(.metadata.createTime // "N/A") | Progress: \(.metadata.progressPercent // 0)%"' 2>/dev/null || \
    curl -s -X GET \
         -H "Authorization: Bearer $(gcloud auth print-access-token)" \
         "https://${LOCATION}-documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/operations?filter=done=false"
    echo ""
}

# Function to get operation details
get_operation_details() {
    local operation_name="$1"
    echo -e "${YELLOW}📊 Operation Details: ${operation_name}${NC}"
    curl -s -X GET \
         -H "Authorization: Bearer $(gcloud auth print-access-token)" \
         "https://${LOCATION}-documentai.googleapis.com/v1/${operation_name}" | \
    jq '.' 2>/dev/null || \
    curl -s -X GET \
         -H "Authorization: Bearer $(gcloud auth print-access-token)" \
         "https://${LOCATION}-documentai.googleapis.com/v1/${operation_name}"
    echo ""
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -a, --all           List all operations"
    echo "  -b, --batch         List batch processing operations only"
    echo "  -r, --running       List currently running operations only"
    echo "  -d, --details NAME  Get details for specific operation"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -a                                    # List all operations"
    echo "  $0 -r                                    # List running operations"
    echo "  $0 -d projects/.../operations/12345      # Get operation details"
}

# Main script logic
main() {
    # Check authentication first
    check_auth

    # Parse command line arguments
    case "${1:-}" in
        -a|--all)
            list_all_operations
            ;;
        -b|--batch)
            list_batch_operations
            ;;
        -r|--running)
            list_running_operations
            ;;
        -d|--details)
            if [[ -z "${2:-}" ]]; then
                echo -e "${RED}❌ Error: Operation name required${NC}"
                show_help
                exit 1
            fi
            get_operation_details "$2"
            ;;
        -h|--help)
            show_help
            ;;
        "")
            # Default: show running operations
            list_running_operations
            list_batch_operations
            ;;
        *)
            echo -e "${RED}❌ Error: Unknown option $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Check if jq is available (for pretty JSON formatting)
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  Warning: jq not found. Output will be raw JSON.${NC}"
    echo -e "${YELLOW}   Install jq for better formatting: brew install jq${NC}"
    echo ""
fi

# Run main function with all arguments
main "$@"
