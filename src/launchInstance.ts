import { EC2Client, RunInstancesCommand, DescribeImagesCommand, CreateKeyPairCommand, CreateSecurityGroupCommand, AuthorizeSecurityGroupIngressCommand, DescribeKeyPairsCommand, DescribeSecurityGroupsCommand } from "@aws-sdk/client-ec2";
import { writeFileSync, existsSync } from 'fs';

const region = 'ap-south-1';
const client = new EC2Client({ region });

// Function to find the latest Ubuntu AMI
const findLatestUbuntuAmi = async () => {
  const describeImagesCommand = new DescribeImagesCommand({
    Filters: [
      { Name: "name", Values: ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"] },
      { Name: "state", Values: ["available"] }
    ],
    Owners: ["099720109477"], // Canonical
  });

  const response = await client.send(describeImagesCommand);
  const images = response.Images || [];
  images.sort((a, b) => (b.CreationDate?.localeCompare(a.CreationDate || '') || 0));
  return images[0].ImageId;
};

// Function to check if a key pair exists
const keyPairExists = async (keyName: string) => {
  try {
    const command = new DescribeKeyPairsCommand({ KeyNames: [keyName] });
    await client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'InvalidKeyPair.NotFound') {
      return false;
    } else {
      throw error;
    }
  }
};

// Function to create a new key pair and save it locally
const createKeyPair = async (keyName: string) => {
  if (await keyPairExists(keyName) && existsSync(`${keyName}.pem`)) {
    console.log(`Key pair ${keyName} already exists.`);
    return keyName;
  }
  const command = new CreateKeyPairCommand({ KeyName: keyName });
  const response = await client.send(command);
  const keyMaterial = response.KeyMaterial;
  if (keyMaterial) {
    writeFileSync(`${keyName}.pem`, keyMaterial);
    console.log(`Key pair created and saved as ${keyName}.pem`);
  }
  return response.KeyName;
};

// Function to check if a security group exists
const securityGroupExists = async (groupName: string) => {
  try {
    const command = new DescribeSecurityGroupsCommand({ GroupNames: [groupName] });
    const response = await client.send(command);
    return response.SecurityGroups?.[0].GroupId || null;
  } catch (error: any) {
    if (error.name === 'InvalidGroup.NotFound') {
      return null;
    } else {
      throw error;
    }
  }
};

// Function to create a security group and set inbound rules
const createSecurityGroup = async (groupName: string) => {
  const existingGroupId = await securityGroupExists(groupName);
  if (existingGroupId) {
    console.log(`Security group ${groupName} already exists.`);
    return existingGroupId;
  }

  const createGroupCommand = new CreateSecurityGroupCommand({
    GroupName: groupName,
    Description: 'Security group for HTTP, HTTPS, and SSH access'
  });

  const response = await client.send(createGroupCommand);
  const securityGroupId = response.GroupId;

  const authorizeIngressCommand = new AuthorizeSecurityGroupIngressCommand({
    GroupId: securityGroupId,
    IpPermissions: [
      {
        IpProtocol: "tcp",
        FromPort: 22,
        ToPort: 22,
        IpRanges: [{ CidrIp: "0.0.0.0/0" }],
      },
      {
        IpProtocol: "tcp",
        FromPort: 80,
        ToPort: 80,
        IpRanges: [{ CidrIp: "0.0.0.0/0" }],
      },
      {
        IpProtocol: "tcp",
        FromPort: 443,
        ToPort: 443,
        IpRanges: [{ CidrIp: "0.0.0.0/0" }],
      },
    ]
  });

  await client.send(authorizeIngressCommand);
  console.log('Security group created and rules added');
  return securityGroupId;
};

// Function to create the EC2 instance
const launchInstance = async (instanceName: string, keyName: string, securityGroupId: string, volumeSize: number) => {
  try {
    const amiId = await findLatestUbuntuAmi();

    const runInstancesCommand = new RunInstancesCommand({
      ImageId: amiId,
      InstanceType: 't2.micro',
      KeyName: keyName,
      MinCount: 1,
      MaxCount: 1,
      SecurityGroupIds: [securityGroupId],
      BlockDeviceMappings: [
        {
          DeviceName: '/dev/sda1',
          Ebs: {
            VolumeSize: volumeSize,
            VolumeType: 'gp2'
          }
        }
      ],
      TagSpecifications: [
        {
          ResourceType: "instance",
          Tags: [
            {
              Key: "Name",
              Value: instanceName
            }
          ]
        }
      ]
    });

    const response = await client.send(runInstancesCommand);
    console.log('EC2 instance created:', response.Instances);
  } catch (error) {
    console.error('Error creating instance:', error);
  }
};

export { launchInstance, createKeyPair, securityGroupExists, createSecurityGroup };
